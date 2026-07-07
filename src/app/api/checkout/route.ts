import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { calcularTaxaPlataforma } from '@/lib/feeRules'
import { getMpToken } from '@/lib/mpToken'
import { rateLimit, getIp, tooManyRequests } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  if (!(await rateLimit(getIp(req), 'checkout', 10, 60_000))) return tooManyRequests()

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

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100) {
        return NextResponse.json({ error: 'Quantidade inválida' }, { status: 400 })
      }
    }

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

    // Cria pedido atomicamente: bloqueia ingressos (FOR UPDATE), verifica estoque,
    // cria orders + order_items em uma única transação — previne overselling por race condition
    const { data: resultado, error: rpcError } = await admin.rpc('criar_pedido_atomico', {
      p_user_id:  user.id,
      p_event_id: eventoId,
      p_items:    lineItems.map(({ ticket, quantity }) => ({
        ticket_id:  ticket.id,
        quantity,
        unit_price: Number(ticket.price ?? 0),
      })),
    })

    if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 })

    if (resultado?.error === 'sem_estoque') {
      const ticketName = tickets.find(t => t.id === resultado.ticket_id)?.name ?? 'Ingresso'
      return NextResponse.json(
        { error: `Quantidade indisponível para "${ticketName}". Restam ${resultado.disponivel ?? 0}.` },
        { status: 409 }
      )
    }

    if (resultado?.error || !resultado?.order_id) {
      return NextResponse.json({ error: 'Erro ao criar pedido' }, { status: 500 })
    }

    const orderId = resultado.order_id as string

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
      const tokenPromotor = await getMpToken(ownerId, admin)

      const { data: mpAccount } = await admin
        .from('promotor_mp_accounts')
        .select('fee_pct')
        .eq('user_id', ownerId)
        .single()

      if (mpAccount && tokenPromotor) {
        mpToken        = tokenPromotor
        // marketplace_fee = total × taxa_plataforma% (modelo Sympla)
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
        external_reference: orderId,
        marketplace_fee:    marketplaceFee,
      },
    })

    // Salva ID da preferência no pedido
    await admin
      .from('orders')
      .update({ mp_preference_id: result.id })
      .eq('id', orderId)

    return NextResponse.json({ checkoutUrl: result.init_point })

  } catch (err) {
    const msg = err instanceof Error
      ? err.message
      : (typeof err === 'string' ? err : 'Erro interno')
    console.error('[checkout]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
