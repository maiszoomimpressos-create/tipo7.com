// POST /api/bilheteria/pix
// Gera QR PIX via Mercado Pago para venda presencial na bilheteria.
// Usa o CPF e token do promotor do evento como pagador (cliente presencial não está logado).
import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getMpToken } from '@/lib/mpToken'
import { rateLimit, getIp, tooManyRequests } from '@/lib/rateLimit'

async function checkPermissaoBilheteria(userId: string, eventoId: string) {
  const admin = createServiceClient()
  const { data: evento } = await admin.from('events').select('organization_id').eq('id', eventoId).single()
  if (!evento) return { ok: false, ownerId: null }
  const { data: org } = await admin.from('organizations').select('owner_id').eq('id', evento.organization_id).single()
  if (org?.owner_id === userId) return { ok: true, ownerId: org.owner_id }

  const { data: staff } = await admin
    .from('event_staff')
    .select('id, event_positions(event_position_permissions(permission))')
    .eq('event_id', eventoId).eq('user_id', userId).eq('status', 'active').single()

  if (!staff) return { ok: false, ownerId: org?.owner_id ?? null }
  const pos = staff.event_positions as unknown as { event_position_permissions: { permission: string }[] } | null
  const temPerm = (pos?.event_position_permissions ?? []).some(p => p.permission === 'vender_ingresso')
  return { ok: temPerm, ownerId: org?.owner_id ?? null }
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(getIp(req), 'bilheteria-pix', 10, 60_000))) return tooManyRequests()

  const supabase = await createClient()
  const admin    = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { eventoId, ticketId, quantidade, comprador } = await req.json() as {
    eventoId:   string
    ticketId:   string
    quantidade: number
    comprador?: { nome?: string; cpf?: string }
  }

  if (!eventoId || !ticketId || !quantidade) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  const { ok, ownerId } = await checkPermissaoBilheteria(user.id, eventoId)
  if (!ok) return NextResponse.json({ error: 'Sem permissão para este evento' }, { status: 403 })
  if (!ownerId) return NextResponse.json({ error: 'Promotor não encontrado' }, { status: 404 })

  // Token MP do promotor
  const mpToken = await getMpToken(ownerId, admin)
  if (!mpToken) return NextResponse.json({ error: 'Promotor não tem conta Mercado Pago conectada.' }, { status: 422 })

  // CPF do promotor (payer obrigatório no MP para PIX)
  const { data: ownerProfile } = await admin.from('profiles').select('full_name, cpf').eq('id', ownerId).single()
  const cpf = ownerProfile?.cpf?.replace(/\D/g, '')
  if (!cpf || cpf.length !== 11) {
    return NextResponse.json({ error: 'Promotor precisa cadastrar CPF no perfil para receber via PIX.' }, { status: 422 })
  }

  // Busca ingresso e valida evento
  const { data: ticket } = await admin.from('event_tickets').select('id, name, price').eq('id', ticketId).eq('event_id', eventoId).single()
  if (!ticket) return NextResponse.json({ error: 'Ingresso não encontrado' }, { status: 404 })

  const total = Number(ticket.price ?? 0) * quantidade
  if (total <= 0) return NextResponse.json({ error: 'PIX não disponível para ingressos gratuitos.' }, { status: 400 })

  // Cria pedido atomicamente
  const { data: resultado, error: rpcError } = await admin.rpc('criar_pedido_atomico', {
    p_user_id:  user.id,
    p_event_id: eventoId,
    p_items:    [{ ticket_id: ticketId, quantity: quantidade, unit_price: Number(ticket.price ?? 0) }],
  })

  if (rpcError) return NextResponse.json({ error: 'Erro ao reservar ingresso' }, { status: 500 })
  if (resultado?.error === 'sem_estoque') {
    return NextResponse.json({ error: `Quantidade indisponível. Restam ${resultado.disponivel ?? 0}.` }, { status: 409 })
  }
  if (!resultado?.order_id) return NextResponse.json({ error: 'Erro ao criar pedido' }, { status: 500 })

  const orderId = resultado.order_id as string

  // Gera QR PIX via Mercado Pago
  const mpClient = new MercadoPagoConfig({ accessToken: mpToken })
  const payment  = new Payment(mpClient)

  const fullName  = ownerProfile?.full_name ?? ''
  const nameParts = fullName.trim().split(' ')
  const firstName = nameParts[0] ?? 'Evento'
  const lastName  = nameParts.slice(1).join(' ') || firstName

  try {
    const { data: eventoInfo } = await admin.from('events').select('title').eq('id', eventoId).single()

    const result = await payment.create({
      body: {
        transaction_amount: total,
        description:        `Bilheteria — ${eventoInfo?.title ?? 'Evento'}`.slice(0, 255),
        payment_method_id:  'pix',
        payer: {
          email:          user.email ?? `bilheteria+${orderId}@tipo7.com`,
          first_name:     firstName,
          last_name:      lastName,
          identification: { type: 'CPF', number: cpf },
        },
        notification_url:   'https://www.tipo7.com/api/webhooks/mercadopago',
        external_reference: orderId,
      },
    })

    const qrCode       = result.point_of_interaction?.transaction_data?.qr_code        ?? null
    const qrCodeBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64 ?? null
    const expiresAt    = result.date_of_expiration ?? null

    await admin.from('orders').update({
      mp_payment_id:      String(result.id),
      pix_qr_code:        qrCode,
      pix_qr_code_base64: qrCodeBase64,
      pix_expires_at:     expiresAt,
      payment_method:     'pix',
    }).eq('id', orderId)

    return NextResponse.json({ orderId, qrCode, qrCodeBase64, expiresAt, total })

  } catch (err) {
    // Cancela o pedido se o MP falhar
    await admin.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    console.error('[bilheteria/pix]', JSON.stringify(err))
    return NextResponse.json({ error: 'Falha ao gerar QR PIX. Tente outro método de pagamento.' }, { status: 500 })
  }
}
