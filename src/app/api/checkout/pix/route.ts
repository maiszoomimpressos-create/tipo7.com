// POST /api/checkout/pix
// ─────────────────────────────────────────────────────────────────────────────
// Checkout Transparente com PIX via Mercado Pago Payments API.
//
// Fluxo:
//   1. Verifica autenticação do comprador
//   2. Valida ingressos e calcula total (preços sempre do banco, nunca do cliente)
//   3. Exige CPF no perfil — MP obriga CPF para pagamentos PIX
//   4. Cria pedido (orders) e itens (order_items) como "pending"
//   5. Chama MP Payments API → recebe QR code + código copia-e-cola
//   6. Salva dados PIX no pedido para a tela de pagamento buscar depois
//   7. Retorna orderId para redirecionar o comprador para /checkout/pix/[orderId]
//
// O webhook /api/webhooks/mercadopago atualiza o status do pedido quando
// o MP confirmar o pagamento.
//
// ATENÇÃO: Use sempre o token de produção (APP_USR-...) no Vercel.
// Token errado causa "Unauthorized use of live credentials" no MP.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { eventoId, items } = await req.json() as {
      eventoId: string
      items: { ticketId: string; quantity: number }[]
    }

    // Verifica sessão do comprador
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    if (!items?.length) return NextResponse.json({ error: 'Nenhum ingresso selecionado' }, { status: 400 })

    const admin = createServiceClient()

    // Busca ingressos e título do evento em paralelo para validar preços
    const ticketIds = items.map(i => i.ticketId)
    const [{ data: tickets }, { data: evento }] = await Promise.all([
      admin.from('event_tickets').select('id, name, price, quantity').in('id', ticketIds).eq('event_id', eventoId),
      admin.from('events').select('title').eq('id', eventoId).single(),
    ])

    if (!tickets?.length) return NextResponse.json({ error: 'Ingressos não encontrados' }, { status: 400 })

    // Monta itens com preços do banco (nunca confiar no que vem do cliente)
    const lineItems = items.map(item => {
      const ticket = tickets.find(t => t.id === item.ticketId)
      if (!ticket) throw new Error(`Ingresso ${item.ticketId} não encontrado`)
      return { ticket, quantity: item.quantity }
    })

    const total = lineItems.reduce((sum, { ticket, quantity }) => sum + Number(ticket.price ?? 0) * quantity, 0)
    if (total <= 0) return NextResponse.json({ error: 'PIX não disponível para ingressos gratuitos' }, { status: 400 })

    // CPF é obrigatório para criar pagamento PIX no MP
    // Se o comprador não tiver CPF cadastrado no perfil, pedimos para preencher antes
    const { data: profile } = await admin.from('profiles').select('cpf, full_name').eq('id', user.id).single()
    const cpf = profile?.cpf?.replace(/\D/g, '')
    if (!cpf || cpf.length !== 11) {
      return NextResponse.json({ error: 'Cadastre seu CPF no perfil antes de pagar com PIX.' }, { status: 422 })
    }

    // Cria pedido com status pending — atualizado para approved pelo webhook do MP
    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({ user_id: user.id, event_id: eventoId, total, status: 'pending' })
      .select('id')
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message ?? 'Erro ao criar pedido' }, { status: 500 })
    }

    // Registra quais ingressos e quantidades fazem parte deste pedido
    await admin.from('order_items').insert(
      lineItems.map(({ ticket, quantity }) => ({
        order_id:   order.id,
        ticket_id:  ticket.id,
        quantity,
        unit_price: Number(ticket.price ?? 0),
      }))
    )

    // Busca conta MP do promotor do evento (split de pagamento)
    const { data: eventOwnerInfo } = await admin
      .from('events')
      .select('organization_id, organizations(owner_id)')
      .eq('id', eventoId)
      .single()

    const orgRaw2  = eventOwnerInfo?.organizations as unknown
    const orgData2 = (Array.isArray(orgRaw2) ? orgRaw2[0] : orgRaw2) as { owner_id: string } | null
    const ownerId2 = orgData2?.owner_id

    let mpToken2:      string           = process.env.MP_ACCESS_TOKEN!
    let applicationFee: number | undefined = undefined

    if (ownerId2) {
      const { data: mpAccount2 } = await admin
        .from('promotor_mp_accounts')
        .select('mp_access_token, fee_pct')
        .eq('user_id', ownerId2)
        .single()

      if (mpAccount2) {
        mpToken2       = mpAccount2.mp_access_token
        applicationFee = Math.round(total * Number(mpAccount2.fee_pct)) / 100
      }
    }

    // Chama a API de Pagamentos do Mercado Pago para gerar o QR PIX
    const mpClient = new MercadoPagoConfig({ accessToken: mpToken2 })
    const payment  = new Payment(mpClient)

    const fullName  = profile?.full_name ?? user.user_metadata?.full_name ?? ''
    const nameParts = fullName.trim().split(' ')
    const firstName = nameParts[0] ?? ''
    // MP exige last_name preenchido — usa o primeiro nome como fallback se for nome único
    const lastName  = nameParts.slice(1).join(' ') || firstName

    const result = await payment.create({
      body: {
        transaction_amount: total,
        // description limitado a 255 chars pois o MP rejeita textos mais longos
        description:        `Ingressos - ${evento?.title ?? 'Evento'}`.slice(0, 255),
        payment_method_id:  'pix',
        payer: {
          email:          user.email ?? '',
          first_name:     firstName,
          last_name:      lastName,
          // CPF é obrigatório para PIX no Brasil (requisito do Banco Central)
          identification: { type: 'CPF', number: cpf },
        },
        // notification_url: o MP chama este endpoint quando o status muda
        // O webhook atualiza orders.status para approved/rejected/etc.
        notification_url:   'https://www.tipo7.com/api/webhooks/mercadopago',
        external_reference: order.id,
        application_fee:    applicationFee,
      },
    })

    // QR code para exibir como imagem; qr_code é o código copia-e-cola
    const qrCode       = result.point_of_interaction?.transaction_data?.qr_code        ?? null
    const qrCodeBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64 ?? null
    // PIX expira em 30 minutos por padrão no MP
    const expiresAt    = result.date_of_expiration ?? null

    // Persiste dados do PIX no pedido para a página /checkout/pix/[orderId] buscar
    await admin.from('orders').update({
      mp_payment_id:      String(result.id),
      pix_qr_code:        qrCode,
      pix_qr_code_base64: qrCodeBase64,
      pix_expires_at:     expiresAt,
    }).eq('id', order.id)

    return NextResponse.json({ orderId: order.id, qrCode, qrCodeBase64, expiresAt, total })

  } catch (err) {
    // O SDK do MP lança o corpo JSON bruto da API quando recebe erro HTTP
    // Isso significa que o erro pode não ser instância de Error — tratar os dois casos
    console.error('[checkout/pix]', JSON.stringify(err))
    let msg = 'Erro interno'
    if (err instanceof Error) {
      msg = err.message
    } else if (err && typeof err === 'object') {
      const e = err as Record<string, unknown>
      msg = String(e.message ?? e.error ?? e.cause ?? JSON.stringify(err))
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
