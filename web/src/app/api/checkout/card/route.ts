// POST /api/checkout/card
// ─────────────────────────────────────────────────────────────────────────────
// Checkout Transparente com Cartão de Crédito via Mercado Pago Payments API.
//
// Fluxo:
//   1. Verifica autenticação do comprador
//   2. Valida ingressos e calcula valor de face (preços sempre do banco)
//   3. Cria pedido atomicamente (criar_pedido_atomico RPC)
//   4. Busca taxas de parcelamento no MP (server-side — nunca confia no valor do cliente)
//   5. Chama MP Payments API com cardToken já tokenizado pelo SDK client-side
//   6. Atualiza status do pedido com o resultado imediato do pagamento
//   7. Retorna { orderId, status } para o cliente redirecionar para a tela correta
//
// Os juros do parcelamento são pagos pelo comprador:
//   - transaction_amount = valor total COM juros (calculado pelo MP)
//   - application_fee    = taxa da plataforma sobre o valor de FACE (sem juros)
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { calcularTaxaPlataforma } from '@/lib/feeRules'
import { getMpToken } from '@/lib/mpToken'
import { rateLimit, getIp, tooManyRequests } from '@/lib/rateLimit'

type MpPayerCost = {
  installments: number
  installment_rate: number
  installment_amount: number
  total_amount: number
}

type MpInstallmentsResponse = Array<{
  payment_method_id: string
  issuer?: { id: number }
  payer_costs: MpPayerCost[]
}>

export async function POST(req: NextRequest) {
  if (!(await rateLimit(getIp(req), 'checkout-card', 5, 60_000))) return tooManyRequests()

  try {
    const {
      eventoId, items,
      cardToken, installments,
      issuerId, paymentMethodId, bin,
    } = await req.json() as {
      eventoId:        string
      items:           { ticketId: string; quantity: number }[]
      cardToken:       string
      installments:    number
      issuerId:        string
      paymentMethodId: string
      bin:             string
    }

    if (!cardToken || !eventoId || !items?.length || !paymentMethodId) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }
    if (!Number.isInteger(installments) || installments < 1 || installments > 12) {
      return NextResponse.json({ error: 'Número de parcelas inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100) {
        return NextResponse.json({ error: 'Quantidade inválida' }, { status: 400 })
      }
    }

    const admin = createServiceClient()

    const ticketIds = items.map(i => i.ticketId)
    const [{ data: tickets }, { data: evento }] = await Promise.all([
      admin.from('event_tickets').select('id, name, price, quantity').in('id', ticketIds).eq('event_id', eventoId),
      admin.from('events').select('title, fee_mode').eq('id', eventoId).single(),
    ])
    const feeMode = (evento?.fee_mode ?? 'promotor') as 'promotor' | 'comprador' | 'mista'

    if (!tickets?.length) return NextResponse.json({ error: 'Ingressos não encontrados' }, { status: 400 })

    const lineItems = items.map(item => {
      const ticket = tickets.find(t => t.id === item.ticketId)
      if (!ticket) throw new Error(`Ingresso ${item.ticketId} não encontrado`)
      return { ticket, quantity: item.quantity }
    })

    // faceValue = valor de face (base para order_items e para o repasse ao promotor)
    const faceValue = lineItems.reduce(
      (sum, { ticket, quantity }) => sum + Number(ticket.price ?? 0) * quantity, 0
    )
    if (faceValue <= 0) return NextResponse.json({ error: 'Valor inválido para pagamento com cartão' }, { status: 400 })

    // Se comprador paga a taxa, o valor cobrado inclui a taxa da plataforma
    // (feePct será resolvido abaixo junto com os dados da conta MP do promotor)

    // Cria pedido atomicamente
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

    // Busca token do promotor e calcula taxa da plataforma
    const { data: eventInfo } = await admin
      .from('events')
      .select('organization_id, organizations(owner_id)')
      .eq('id', eventoId)
      .single()

    const orgRaw  = eventInfo?.organizations as unknown
    const orgData = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as { owner_id: string } | null
    const ownerId = orgData?.owner_id

    // Busca taxa mínima e taxas MP por método
    const { data: feeSettings } = await admin
      .from('platform_settings')
      .select('key, value')
      .in('key', ['min_fee_pct', 'fee_pct_credito_1x', 'fee_pct_credito_6x', 'fee_pct_credito_12x'])
    const feeMap: Record<string, string> = {}
    for (const row of feeSettings ?? []) feeMap[row.key] = row.value
    const minFeePct = Number(feeMap['min_fee_pct'] ?? 0)

    const parsePct = (v: string | undefined, def: string) =>
      parseFloat((v ?? def).replace(',', '.'))
    const mpCardPct =
      installments === 1  ? parsePct(feeMap['fee_pct_credito_1x'],  '4.98') :
      installments <= 6   ? parsePct(feeMap['fee_pct_credito_6x'],  '5.98') :
                            parsePct(feeMap['fee_pct_credito_12x'], '6.98')

    let mpToken      = process.env.MP_ACCESS_TOKEN!
    let mpAccountFee: number | undefined = undefined

    if (ownerId) {
      const tokenPromotor = await getMpToken(ownerId, admin)
      const { data: mpAccount } = await admin
        .from('promotor_mp_accounts')
        .select('fee_pct')
        .eq('user_id', ownerId)
        .single()
      if (mpAccount && tokenPromotor) {
        mpToken      = tokenPromotor
        mpAccountFee = Number(mpAccount.fee_pct)
      }
    }

    // Busca o valor total com juros na API do MP (nunca confia no cliente)
    // Base para consulta de parcelamento: inclui a parte do comprador na taxa
    const baseParcelamento =
      feeMode === 'comprador' && mpAccountFee !== undefined
        ? Math.round(faceValue * (1 + mpAccountFee / 100) * 100) / 100
        : feeMode === 'mista' && mpAccountFee !== undefined
          ? Math.round(faceValue * (1 + mpAccountFee / 2 / 100) * 100) / 100
          : faceValue

    let transactionAmount = baseParcelamento
    try {
      const url = new URL('https://api.mercadopago.com/v1/payment_methods/installments')
      url.searchParams.set('payment_method_id', paymentMethodId)
      url.searchParams.set('amount',            String(baseParcelamento))
      if (issuerId) url.searchParams.set('issuer.id', issuerId)
      if (bin)      url.searchParams.set('bin',        bin.slice(0, 6))

      const mpRes = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${mpToken}` },
      })
      if (mpRes.ok) {
        const data = await mpRes.json() as MpInstallmentsResponse
        const chosen = data[0]?.payer_costs?.find(c => c.installments === installments)
        if (chosen?.total_amount) transactionAmount = chosen.total_amount
      }
    } catch {
      // Fallback: usa baseParcelamento (equivale a 1× sem juros)
    }

    // Calcula application_fee
    let applicationFee: number | undefined = undefined
    if (ownerId && mpAccountFee !== undefined) {
      if (feeMode === 'comprador') {
        // Comprador paga 100% da taxa — promotor recebe exatamente o valor de face
        applicationFee = Math.max(0, Math.round(
          (transactionAmount * (1 - mpCardPct / 100) - faceValue) * 100
        ) / 100)
      } else if (feeMode === 'mista') {
        // Taxa dividida — promotor recebe exatamente (faceValue - metade da taxa)
        const promoterTarget = Math.round(faceValue * (1 - mpAccountFee / 2 / 100) * 100) / 100
        applicationFee = Math.max(0, Math.round(
          (transactionAmount * (1 - mpCardPct / 100) - promoterTarget) * 100
        ) / 100)
      } else {
        // Promotor absorve (Modelo B): ajusta application_fee para promotor receber (100 - feePct)% do face
        // Variável intermediária evita excess-property-check causado por cache de tsbuildinfo no Vercel
        const calcParams = {
          eventoId,
          ownerId,
          total:             faceValue,
          ticketCount:       lineItems.reduce((s, i) => s + i.quantity, 0),
          feePct:            mpAccountFee,
          minFeePct,
          admin,
          mpFeePct:          mpCardPct,
          transactionAmount,
        }
        applicationFee = await calcularTaxaPlataforma(calcParams)
      }
    }

    // Cria pagamento no Mercado Pago
    const mpClient = new MercadoPagoConfig({ accessToken: mpToken })
    const payment  = new Payment(mpClient)

    const result = await payment.create({
      body: {
        transaction_amount: transactionAmount,
        token:              cardToken,
        description:        `Ingressos - ${evento?.title ?? 'Evento'}`.slice(0, 255),
        installments,
        payment_method_id:  paymentMethodId,
        issuer_id:          issuerId ? Number(issuerId) : undefined,
        payer: {
          email: user.email ?? '',
        },
        notification_url:   'https://www.tipo7.com/api/webhooks/mercadopago',
        external_reference: orderId,
        application_fee:    applicationFee,
      },
    })

    const paymentStatus = result.status ?? 'rejected'
    const mpPaymentId   = String(result.id)

    const orderStatus =
      paymentStatus === 'approved'   ? 'approved'   :
      paymentStatus === 'in_process' ? 'in_process' :
      paymentStatus === 'pending'    ? 'pending'     :
      'rejected'

    await admin.from('orders').update({
      status:        orderStatus,
      mp_payment_id: mpPaymentId,
      updated_at:    new Date().toISOString(),
    }).eq('id', orderId)

    return NextResponse.json({ orderId, status: paymentStatus, paymentId: mpPaymentId })

  } catch (err) {
    console.error('[checkout/card]', JSON.stringify(err))

    // O SDK do MP lança um array em cause quando a API retorna erro estruturado
    const mpErr = err as { cause?: Array<{ code?: string; description?: string }> }
    if (mpErr?.cause?.length) {
      const desc = mpErr.cause[0]?.description ?? 'Pagamento recusado pelo emissor.'
      return NextResponse.json({ error: desc }, { status: 422 })
    }

    return NextResponse.json({ error: 'Falha ao processar pagamento. Tente novamente.' }, { status: 500 })
  }
}
