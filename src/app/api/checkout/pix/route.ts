// POST /api/checkout/pix
// Cria pagamento PIX via MP Payments API e retorna QR code
import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { eventoId, items } = await req.json() as {
      eventoId: string
      items: { ticketId: string; quantity: number }[]
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    if (!items?.length) return NextResponse.json({ error: 'Nenhum ingresso selecionado' }, { status: 400 })

    const admin = createServiceClient()

    // Busca ingressos e evento para validar preços e pegar título
    const ticketIds = items.map(i => i.ticketId)
    const [{ data: tickets }, { data: evento }] = await Promise.all([
      admin.from('event_tickets').select('id, name, price, quantity').in('id', ticketIds).eq('event_id', eventoId),
      admin.from('events').select('title').eq('id', eventoId).single(),
    ])

    if (!tickets?.length) return NextResponse.json({ error: 'Ingressos não encontrados' }, { status: 400 })

    const lineItems = items.map(item => {
      const ticket = tickets.find(t => t.id === item.ticketId)
      if (!ticket) throw new Error(`Ingresso ${item.ticketId} não encontrado`)
      return { ticket, quantity: item.quantity }
    })

    const total = lineItems.reduce((sum, { ticket, quantity }) => sum + Number(ticket.price ?? 0) * quantity, 0)
    if (total <= 0) return NextResponse.json({ error: 'PIX não disponível para ingressos gratuitos' }, { status: 400 })

    // Busca CPF do usuário na tabela de perfis (obrigatório para PIX)
    const { data: profile } = await admin.from('profiles').select('cpf, full_name').eq('id', user.id).single()
    const cpf = profile?.cpf?.replace(/\D/g, '')
    if (!cpf || cpf.length !== 11) {
      return NextResponse.json({ error: 'Cadastre seu CPF no perfil antes de pagar com PIX.' }, { status: 422 })
    }

    // Cria pedido pendente
    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({ user_id: user.id, event_id: eventoId, total, status: 'pending' })
      .select('id')
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message ?? 'Erro ao criar pedido' }, { status: 500 })
    }

    // Cria itens do pedido
    await admin.from('order_items').insert(
      lineItems.map(({ ticket, quantity }) => ({
        order_id:   order.id,
        ticket_id:  ticket.id,
        quantity,
        unit_price: Number(ticket.price ?? 0),
      }))
    )

    // Cria pagamento PIX no Mercado Pago
    const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
    const payment  = new Payment(mpClient)

    const fullName  = profile?.full_name ?? user.user_metadata?.full_name ?? ''
    const nameParts = fullName.trim().split(' ')
    const firstName = nameParts[0] ?? ''
    const lastName  = nameParts.slice(1).join(' ') || firstName

    const result = await payment.create({
      body: {
        transaction_amount: total,
        description:        `Ingressos — ${evento?.title ?? 'Evento'}`,
        payment_method_id:  'pix',
        payer: {
          email:      user.email ?? '',
          first_name: firstName,
          last_name:  lastName,
          identification: { type: 'CPF', number: cpf },
        },
        notification_url:   'https://www.tipo7.com/api/webhooks/mercadopago',
        external_reference: order.id,
      },
    })

    const qrCode       = result.point_of_interaction?.transaction_data?.qr_code       ?? null
    const qrCodeBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64 ?? null
    const expiresAt    = result.date_of_expiration ?? null

    // Salva o pagamento e QR code no pedido
    await admin.from('orders').update({
      mp_payment_id:      String(result.id),
      pix_qr_code:        qrCode,
      pix_qr_code_base64: qrCodeBase64,
      pix_expires_at:     expiresAt,
    }).eq('id', order.id)

    return NextResponse.json({
      orderId:       order.id,
      qrCode,
      qrCodeBase64,
      expiresAt,
      total,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[checkout/pix]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
