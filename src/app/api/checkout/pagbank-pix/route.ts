// POST /api/checkout/pagbank-pix
// ─────────────────────────────────────────────────────────────────────────────
// Checkout Transparente com PIX via PagBank Orders API.
//
// Fluxo:
//   1. Verifica autenticação do comprador
//   2. Valida ingressos e calcula total (preços sempre do banco, nunca do cliente)
//   3. Cria pedido atomicamente via RPC (previne overselling)
//   4. Chama PagBank POST /orders → recebe QR code copia-e-cola
//   5. Salva pagbank_charge_id, pagbank_pix_qr_code, pagbank_pix_expires_at no pedido
//   6. Retorna { orderId, qrCode, expiresAt, total }
//
// O webhook /api/webhooks/pagbank atualiza o status do pedido quando
// o PagBank confirmar o pagamento.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { rateLimit, getIp, tooManyRequests } from '@/lib/rateLimit'
import { pagbankPost, PagBankError } from '@/lib/pagbankClient'
import { buildPagBankPixOrder } from '@/lib/pagbankPix'

// Resposta esperada do endpoint POST /orders do PagBank
interface PagBankOrderResponse {
  id:       string
  charges?: Array<{ id: string; status: string }>
  qr_codes?: Array<{
    id:              string
    text:            string   // código copia-e-cola (nosso "qrCode")
    expiration_date: string
    amount:          { value: number }
  }>
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 tentativas por minuto por IP (mesmo limite do MP PIX)
  const isLocal = process.env.NODE_ENV === 'development'
  if (!(await rateLimit(getIp(req), 'checkout-pagbank-pix', isLocal ? 100 : 10, 60_000))) {
    return tooManyRequests()
  }

  try {
    const { eventoId, items, cpf, buyerName, buyerEmail } = await req.json() as {
      eventoId:   string
      items:      { ticketId: string; quantity: number }[]
      cpf:        string
      buyerName:  string
      buyerEmail: string
    }

    // Verifica sessão do comprador
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    if (!items?.length) return NextResponse.json({ error: 'Nenhum ingresso selecionado' }, { status: 400 })

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100) {
        return NextResponse.json({ error: 'Quantidade inválida' }, { status: 400 })
      }
    }

    const cleanCpf = cpf?.replace(/\D/g, '')
    if (!cleanCpf || cleanCpf.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido. Informe um CPF com 11 dígitos.' }, { status: 422 })
    }

    const admin = createServiceClient()

    // Bloqueia se promotor pausou vendas online para abrir caixas
    const { data: eventoFlag } = await admin
      .from('events')
      .select('vendas_online_pausadas')
      .eq('id', eventoId)
      .single()
    if (eventoFlag?.vendas_online_pausadas) {
      return NextResponse.json(
        { error: 'Vendas temporariamente pausadas. Tente novamente em instantes.' },
        { status: 503 }
      )
    }

    // Busca ingressos e dados do evento em paralelo para validar preços
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

    // Valor total de face em R$ (base de cobrança — PagBank não tem split automático)
    const faceValue = lineItems.reduce(
      (sum, { ticket, quantity }) => sum + Number(ticket.price ?? 0) * quantity,
      0
    )
    if (faceValue <= 0) {
      return NextResponse.json({ error: 'PIX não disponível para ingressos gratuitos' }, { status: 400 })
    }

    // Cria pedido atomicamente: bloqueia ingressos, verifica estoque, cria orders + order_items
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

    // PIX expira em 30 minutos (mesmo padrão do Mercado Pago)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    // Chama a API do PagBank para criar a ordem PIX
    const orderBody = buildPagBankPixOrder({
      amount:          faceValue,
      description:     `Ingressos - ${evento?.title ?? 'Evento'}`,
      referenceId:     orderId,
      buyerName:       buyerName.trim() || 'Comprador',
      buyerCpf:        cleanCpf,
      buyerEmail:      buyerEmail || (user.email ?? ''),
      notificationUrl: 'https://www.tipo7.com/api/webhooks/pagbank',
      expiresAt,
    })

    const pbResponse = await pagbankPost<PagBankOrderResponse>(
      '/orders',
      orderBody,
      orderId, // Idempotência: garante que tentativas repetidas não criam cobranças duplicadas
    )

    // Extrai código copia-e-cola do QR PIX da resposta
    const qrCode         = pbResponse.qr_codes?.[0]?.text ?? null
    const qrExpiresAt    = pbResponse.qr_codes?.[0]?.expiration_date ?? expiresAt
    // charge_id pode estar no nível do pedido (id) ou dentro de charges[]
    const pagbankChargeId = pbResponse.charges?.[0]?.id ?? pbResponse.id

    // Persiste dados do PagBank no pedido para a página de pagamento buscar
    await admin.from('orders').update({
      gateway:               'pagbank',
      pagbank_charge_id:     pagbankChargeId,
      pagbank_pix_qr_code:  qrCode,
      pagbank_pix_expires_at: qrExpiresAt,
    }).eq('id', orderId)

    return NextResponse.json({
      orderId,
      qrCode,
      expiresAt: qrExpiresAt,
      total:     faceValue,
    })

  } catch (err) {
    if (err instanceof PagBankError) {
      console.error('[checkout/pagbank-pix] PagBank error:', err.status, JSON.stringify(err.body))
      return NextResponse.json({ error: 'Falha ao processar pagamento. Tente novamente.' }, { status: 502 })
    }
    console.error('[checkout/pagbank-pix]', JSON.stringify(err))
    return NextResponse.json({ error: 'Falha ao processar pagamento. Tente novamente.' }, { status: 500 })
  }
}
