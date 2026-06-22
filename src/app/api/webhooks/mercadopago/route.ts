import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createServiceClient } from '@/lib/supabase/server'
import { sendTicketEmail } from '@/lib/email'

const STATUS_MAP: Record<string, string> = {
  approved:   'approved',
  pending:    'in_process',
  in_process: 'in_process',
  rejected:   'rejected',
  cancelled:  'cancelled',
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { type?: string; data?: { id?: string | number } }

  // MP envia vários tipos de notificação — só processa pagamentos
  if (body.type !== 'payment') return NextResponse.json({ ok: true })

  const paymentId = body.data?.id
  if (!paymentId) return NextResponse.json({ ok: true })

  // Busca detalhes do pagamento na API do MP
  const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
  const payment  = new Payment(mpClient)
  const paymentData = await payment.get({ id: String(paymentId) })

  const orderId = paymentData.external_reference
  if (!orderId) return NextResponse.json({ ok: true })

  const newStatus = STATUS_MAP[paymentData.status ?? ''] ?? 'pending'

  const admin = createServiceClient()

  await admin
    .from('orders')
    .update({
      status:         newStatus,
      mp_payment_id:  String(paymentId),
      updated_at:     new Date().toISOString(),
    })
    .eq('id', orderId)

  // Gera tickets e envia email apenas quando o pagamento for aprovado
  if (newStatus === 'approved') {
    // 1. Busca itens do pedido
    const { data: items } = await admin
      .from('order_items')
      .select('id, quantity, event_tickets(name)')
      .eq('order_id', orderId)

    if (items && items.length > 0) {
      // 2. Gera um ticket por slot (upsert evita duplicatas se webhook disparar 2x)
      const ticketRows = items.flatMap(item =>
        Array.from({ length: item.quantity }, (_, i) => ({
          order_id:      orderId,
          order_item_id: item.id,
          slot_number:   i + 1,
        }))
      )

      await admin
        .from('tickets')
        .upsert(ticketRows, { onConflict: 'order_item_id,slot_number', ignoreDuplicates: true })

      // 3. Busca os tickets gerados (com qr_token) para montar o email
      const { data: generatedTickets } = await admin
        .from('tickets')
        .select('order_item_id, slot_number, qr_token')
        .eq('order_id', orderId)

      // 4. Busca dados do comprador e do evento para o email
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
        // Busca o email do usuário via auth admin
        const { data: { user } } = await admin.auth.admin.getUserById(order.user_id)

        if (user?.email) {
          // Supabase retorna joins como array ou objeto — normaliza com unknown
          const rawEvent   = order.events   as unknown as { title: string; date_start: string | null; venue_name: string | null; city: string | null; state: string | null; banner_url: string | null } | null
          const rawProfile = order.profiles as unknown as { full_name: string | null } | null
          const event      = Array.isArray(rawEvent)   ? rawEvent[0]   : rawEvent
          const profile    = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile
          const buyerName  = profile?.full_name ?? 'Cliente'

          // Monta lista de tickets com nome do ingresso
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

          // Envia email — erro aqui não deve quebrar o webhook
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
