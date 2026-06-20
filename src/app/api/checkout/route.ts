import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { eventoId, items } = await req.json() as {
      eventoId: string
      items: { ticketId: string; quantity: number }[]
    }

    // Verifica autenticação
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    if (!items?.length) return NextResponse.json({ error: 'Nenhum ingresso selecionado' }, { status: 400 })

    const admin = createServiceClient()

    // Busca ingressos no banco para validar preços
    const ticketIds = items.map(i => i.ticketId)
    const { data: tickets, error: ticketsError } = await admin
      .from('event_tickets')
      .select('id, name, price, quantity')
      .in('id', ticketIds)
      .eq('event_id', eventoId)

    if (ticketsError) return NextResponse.json({ error: ticketsError.message }, { status: 500 })
    if (!tickets?.length) return NextResponse.json({ error: 'Ingressos não encontrados' }, { status: 400 })

    // Monta itens com valores do banco (nunca confiar no cliente)
    const lineItems = items.map(item => {
      const ticket = tickets.find(t => t.id === item.ticketId)
      if (!ticket) throw new Error(`Ingresso ${item.ticketId} não encontrado`)
      return { ticket, quantity: item.quantity }
    })

    const total = lineItems.reduce(
      (sum, { ticket, quantity }) => sum + Number(ticket.price ?? 0) * quantity, 0
    )

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

    // Cria preferência no Mercado Pago
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
    const preference = new Preference(client)

    const result = await preference.create({
      body: {
        items: lineItems.map(({ ticket, quantity }) => ({
          id:          ticket.id,
          title:       ticket.name ?? 'Ingresso',
          quantity,
          unit_price:  Number(ticket.price ?? 0),
          currency_id: 'BRL',
        })),
        payer: { email: user.email ?? '' },
        back_urls: {
          success: 'https://tipo7.com/checkout/sucesso',
          failure: 'https://tipo7.com/checkout/falha',
          pending: 'https://tipo7.com/checkout/pendente',
        },
        auto_return:        'approved',
        notification_url:   'https://tipo7.com/api/webhooks/mercadopago',
        external_reference: order.id,
      },
    })

    // Salva ID da preferência no pedido
    await admin
      .from('orders')
      .update({ mp_preference_id: result.id })
      .eq('id', order.id)

    return NextResponse.json({ checkoutUrl: result.init_point })

  } catch (err) {
    const msg = err instanceof Error
      ? err.message
      : (typeof err === 'string' ? err : 'Erro interno')
    console.error('[checkout]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
