import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createServiceClient } from '@/lib/supabase/server'
import { sendTicketEmail } from '@/lib/email'
import { gerarQrToken } from '@/lib/qrToken'
import { getMpToken } from '@/lib/mpToken'
import { createHmac } from 'crypto'

const STATUS_MAP: Record<string, string> = {
  approved:   'approved',
  pending:    'in_process',
  in_process: 'in_process',
  rejected:   'rejected',
  cancelled:  'cancelled',
}

function verificarAssinatura(req: NextRequest, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) {
    // Sem secret configurado: aceita mas avisa — nunca deve acontecer em produção
    console.warn('[webhook] MP_WEBHOOK_SECRET não configurado — verificação de assinatura ignorada')
    return true
  }

  const xSignature = req.headers.get('x-signature') ?? ''
  const xRequestId = req.headers.get('x-request-id') ?? ''

  const ts = xSignature.match(/ts=([^,]+)/)?.[1] ?? ''
  const v1 = xSignature.match(/v1=([^,]+)/)?.[1] ?? ''
  if (!ts || !v1) return false

  const age = Math.abs(Date.now() - parseInt(ts) * 1000)
  if (age > 5 * 60 * 1000) return false

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')
  return expected === v1
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  let body: { type?: string; data?: { id?: string | number } }
  try { body = JSON.parse(rawBody) } catch { return NextResponse.json({ ok: true }) }

  if (body.type !== 'payment') return NextResponse.json({ ok: true })

  const paymentId = body.data?.id
  if (!paymentId) return NextResponse.json({ ok: true })

  if (!verificarAssinatura(req, String(paymentId))) {
    console.warn('[webhook] assinatura inválida — requisição rejeitada')
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }

  const admin = createServiceClient()

  // Descobre o token correto para buscar o pagamento.
  // Pagamentos de bilheteria são criados com o token OAuth do dono do evento,
  // não com o token da plataforma — usar token errado retorna 403 no MP.
  let mpAccessToken = process.env.MP_ACCESS_TOKEN!

  const { data: orderRow } = await admin
    .from('orders')
    .select('event_id')
    .eq('mp_payment_id', String(paymentId))
    .maybeSingle()

  if (orderRow?.event_id) {
    const { data: evento } = await admin
      .from('events')
      .select('organization_id')
      .eq('id', orderRow.event_id)
      .single()

    if (evento?.organization_id) {
      const { data: org } = await admin
        .from('organizations')
        .select('owner_id')
        .eq('id', evento.organization_id)
        .single()

      if (org?.owner_id) {
        const promoterToken = await getMpToken(org.owner_id, admin)
        if (promoterToken) mpAccessToken = promoterToken
      }
    }
  }

  const mpClient = new MercadoPagoConfig({ accessToken: mpAccessToken })
  const payment  = new Payment(mpClient)

  let paymentData: Awaited<ReturnType<typeof payment.get>>
  try {
    paymentData = await payment.get({ id: String(paymentId) })
  } catch (err) {
    console.error('[webhook] erro ao buscar pagamento no MP:', JSON.stringify(err))
    return NextResponse.json({ error: 'Erro ao buscar pagamento' }, { status: 500 })
  }

  const orderId = paymentData.external_reference
  if (!orderId) return NextResponse.json({ ok: true })

  const newStatus = STATUS_MAP[paymentData.status ?? ''] ?? 'pending'

  // Idempotência: insert na tabela de webhooks processados.
  // Código 23505 = violação de chave única = já processado → ignora.
  // Qualquer outro erro = tabela inexistente ou problema real → loga e continua processando.
  const { error: idempotencyError } = await admin
    .from('processed_webhooks')
    .insert({ payment_id: String(paymentId), order_id: orderId })

  if (idempotencyError) {
    if ((idempotencyError as { code?: string }).code === '23505') {
      console.log(`[webhook] payment ${paymentId} já processado, ignorando`)
      return NextResponse.json({ ok: true })
    }
    console.error('[webhook] erro na tabela processed_webhooks (continuando):', idempotencyError)
  }

  await admin
    .from('orders')
    .update({
      status:        newStatus,
      mp_payment_id: String(paymentId),
      updated_at:    new Date().toISOString(),
    })
    .eq('id', orderId)

  if (newStatus === 'approved') {
    const { data: items } = await admin
      .from('order_items')
      .select('id, quantity, event_tickets(name)')
      .eq('order_id', orderId)

    if (items && items.length > 0) {
      const ticketRows = items.flatMap(item =>
        Array.from({ length: item.quantity }, (_, i) => ({
          order_id:      orderId,
          order_item_id: item.id,
          slot_number:   i + 1,
          qr_token:      gerarQrToken(),
        }))
      )

      await admin
        .from('tickets')
        .upsert(ticketRows, { onConflict: 'order_item_id,slot_number', ignoreDuplicates: true })

      const { data: generatedTickets } = await admin
        .from('tickets')
        .select('order_item_id, slot_number, qr_token')
        .eq('order_id', orderId)

      const { data: order } = await admin
        .from('orders')
        .select(`
          user_id,
          events (title, date_start, venue_name, city, state, banner_url),
          profiles:user_id (full_name)
        `)
        .eq('id', orderId)
        .single()

      if (order && generatedTickets && process.env.RESEND_API_KEY) {
        const { data: { user } } = await admin.auth.admin.getUserById(order.user_id)

        if (user?.email) {
          const rawEvent   = order.events   as unknown as { title: string; date_start: string | null; venue_name: string | null; city: string | null; state: string | null; banner_url: string | null } | null
          const rawProfile = order.profiles as unknown as { full_name: string | null } | null
          const event      = Array.isArray(rawEvent)   ? rawEvent[0]   : rawEvent
          const profile    = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile
          const buyerName  = profile?.full_name ?? 'Cliente'

          const ticketEmailList = generatedTickets.map(t => {
            const item       = items.find(i => i.id === t.order_item_id)
            const rawTicket  = item?.event_tickets as unknown
            const ticketData = Array.isArray(rawTicket) ? rawTicket[0] as { name: string } : rawTicket as { name: string } | null
            return {
              ticket_name: ticketData?.name ?? 'Ingresso',
              slot_number: t.slot_number,
              qr_token:    t.qr_token,
            }
          })

          await sendTicketEmail({
            to:        user.email,
            buyerName,
            event:     event ?? { title: 'Evento', date_start: null, venue_name: null, city: null, state: null, banner_url: null },
            tickets:   ticketEmailList,
          }).catch(err => console.error('[email] falha ao enviar:', err))
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
