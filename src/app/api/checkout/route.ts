import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { calcularTaxaPlataforma } from '@/lib/feeRules'

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

    // Valida disponibilidade: quantidade total menos o que já foi vendido (pedidos não cancelados)
    const { data: vendidos } = await admin
      .from('order_items')
      .select('ticket_id, quantity, orders!inner(status)')
      .in('ticket_id', ticketIds)
      .not('orders.status', 'in', '("rejected","cancelled")')

    const vendidosPorTicket: Record<string, number> = {}
    for (const v of vendidos ?? []) {
      vendidosPorTicket[v.ticket_id] = (vendidosPorTicket[v.ticket_id] ?? 0) + v.quantity
    }
    for (const { ticket, quantity } of lineItems) {
      const disponivel = ticket.quantity - (vendidosPorTicket[ticket.id] ?? 0)
      if (quantity > disponivel) {
        return NextResponse.json(
          { error: `Quantidade indisponível para "${ticket.name}". Restam ${disponivel}.` },
          { status: 409 }
        )
      }
    }

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

    // Busca taxa mínima da plataforma
    const { data: minFeeSetting } = await admin
      .from('platform_settings').select('value').eq('key', 'min_fee_pct').maybeSingle()
    const minFeePct = Number(minFeeSetting?.value ?? 0)

    // Busca conta MP do promotor do evento (split de pagamento)
    const { data: eventInfo } = await admin
      .from('events')
      .select('organization_id, organizations(owner_id)')
      .eq('id', eventoId)
      .single()

    const orgRaw  = eventInfo?.organizations as unknown
    const orgData = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as { owner_id: string } | null
    const ownerId = orgData?.owner_id

    let mpToken:       string           = process.env.MP_ACCESS_TOKEN!
    let marketplaceFee: number | undefined = undefined

    if (ownerId) {
      const { data: mpAccount } = await admin
        .from('promotor_mp_accounts')
        .select('mp_access_token, fee_pct')
        .eq('user_id', ownerId)
        .single()

      if (mpAccount) {
        mpToken        = mpAccount.mp_access_token
        marketplaceFee = await calcularTaxaPlataforma({
          eventoId,
          ownerId,
          total,
          ticketCount: lineItems.reduce((s, i) => s + i.quantity, 0),
          feePct:      Number(mpAccount.fee_pct),
          minFeePct,
          admin,
        })
      }
    }

    // Cria preferência no Mercado Pago
    const client = new MercadoPagoConfig({ accessToken: mpToken })
    const preference = new Preference(client)

    // back_urls sempre apontam para produção — MP rejeita localhost em credenciais reais
    const MP_BASE_URL = 'https://www.tipo7.com'

    const result = await preference.create({
      body: {
        items: lineItems.map(({ ticket, quantity }) => ({
          id:          ticket.id,
          title:       ticket.name ?? 'Ingresso',
          quantity,
          unit_price:  Number(ticket.price ?? 0),
          currency_id: 'BRL',
        })),
        payer: {
          email:   user.email ?? '',
          name:    user.user_metadata?.full_name?.split(' ')[0] ?? '',
          surname: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') ?? '',
        },
        back_urls: {
          success: `${MP_BASE_URL}/checkout/sucesso`,
          failure: `${MP_BASE_URL}/checkout/falha`,
          pending: `${MP_BASE_URL}/checkout/pendente`,
        },
        auto_return:        'approved',
        notification_url:   `${MP_BASE_URL}/api/webhooks/mercadopago`,
        external_reference: order.id,
        marketplace_fee:    marketplaceFee,
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
