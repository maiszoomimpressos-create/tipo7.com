// POST /api/checkout/pagbank-card
// ─────────────────────────────────────────────────────────────────────────────
// Checkout Transparente com Cartão de Crédito via PagBank Orders API.
//
// Fluxo:
//   1. Verifica autenticação do comprador
//   2. Valida ingressos e calcula valor de face (preços sempre do banco)
//   3. Cria pedido atomicamente via RPC
//   4. Chama PagBank POST /orders com charge de cartão criptografado
//   5. Atualiza status do pedido imediatamente (resposta síncrona do PagBank)
//   6. Retorna { orderId, status }
//
// PagBank cartão é síncrono — o status de aprovação/recusa é imediato.
// Não há webhook para cartão aprovado; o status vem direto na resposta.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { rateLimit, getIp, tooManyRequests } from '@/lib/rateLimit'
import { pagbankPost, PagBankError } from '@/lib/pagbankClient'
import { issueTickets } from '@/lib/issueTickets'
import { resolvePagBankSplit } from '@/lib/pagbankToken'
import { resolveEventGateway } from '@/lib/resolveGateway'

// Resposta do PagBank para ordem com cartão
interface PagBankCardOrderResponse {
  id: string
  charges?: Array<{
    id:     string
    status: string  // PAID | DECLINED | CANCELLED | IN_ANALYSIS | AUTHORIZED
  }>
}

// Mapeamento de status PagBank → status interno do sistema
const STATUS_MAP: Record<string, string> = {
  PAID:        'approved',
  AUTHORIZED:  'approved',
  IN_ANALYSIS: 'in_process',
  DECLINED:    'rejected',
  CANCELLED:   'cancelled',
}

export async function POST(req: NextRequest) {
  // Rate limit mais restritivo para cartão (mesmo limite do MP card — 5/min)
  const isLocal = process.env.NODE_ENV === 'development'
  if (!(await rateLimit(getIp(req), 'checkout-pagbank-card', isLocal ? 100 : 5, 60_000))) {
    return tooManyRequests()
  }

  try {
    const {
      eventoId, items, encryptedCard, installments,
      buyerName, buyerEmail, cpf,
    } = await req.json() as {
      eventoId:      string
      items:         { ticketId: string; quantity: number }[]
      encryptedCard: string  // cartão criptografado pelo SDK JS do PagBank (client-side)
      installments:  number
      buyerName:     string
      buyerEmail:    string
      cpf:           string
    }

    if (!encryptedCard || !eventoId || !items?.length) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }
    if (!Number.isInteger(installments) || installments < 1 || installments > 12) {
      return NextResponse.json({ error: 'Número de parcelas inválido' }, { status: 400 })
    }

    const cleanCpf = cpf?.replace(/\D/g, '')
    if (!cleanCpf || cleanCpf.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido.' }, { status: 422 })
    }

    // Verifica sessão do comprador
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100) {
        return NextResponse.json({ error: 'Quantidade inválida' }, { status: 400 })
      }
    }

    const admin = createServiceClient()

    // Busca ingressos e dados do evento em paralelo
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

    const faceValue = lineItems.reduce(
      (sum, { ticket, quantity }) => sum + Number(ticket.price ?? 0) * quantity,
      0
    )
    if (faceValue <= 0) {
      return NextResponse.json({ error: 'Valor inválido para pagamento com cartão' }, { status: 400 })
    }

    // Resolve o dono do evento e exige conta PagBank conectada — nunca cai de
    // volta pra conta única da Tipo7 (evita misturar dinheiro de promotores
    // diferentes e o problema de tributação sobre o valor cheio).
    const { ownerId } = await resolveEventGateway(eventoId, admin)
    const centavosTotal = Math.round(faceValue * 100)
    const splits = ownerId ? await resolvePagBankSplit(ownerId, admin, centavosTotal) : null
    if (!splits) {
      return NextResponse.json(
        { error: 'O promotor deste evento ainda não conectou uma conta PagBank. Pagamento indisponível.' },
        { status: 503 }
      )
    }

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

    // Monta o corpo da ordem PagBank com pagamento por cartão
    // PagBank usa centavos (inteiros)
    const centavos = Math.round(faceValue * 100)

    const pbResponse = await pagbankPost<PagBankCardOrderResponse>(
      '/orders',
      {
        reference_id: orderId,
        customer: {
          name:   buyerName.trim() || 'Comprador',
          email:  buyerEmail || (user.email ?? ''),
          tax_id: cleanCpf,
        },
        items: [
          {
            name:        `Ingressos - ${evento?.title ?? 'Evento'}`.slice(0, 255),
            quantity:    1,
            unit_amount: centavos,
          },
        ],
        // PagBank cartão usa o array charges, não qr_codes como o PIX
        charges: [
          {
            reference_id:   orderId,
            description:    `Ingressos - ${evento?.title ?? 'Evento'}`.slice(0, 100),
            amount:         { value: centavos, currency: 'BRL' },
            splits,
            payment_method: {
              type:         'CREDIT_CARD',
              installments,
              capture:      true,  // captura imediata
              card: {
                encrypted: encryptedCard,
                security_code: null,  // já incluído no encryptedCard pelo SDK client-side
                holder: {
                  name:   buyerName.trim() || 'Comprador',
                  tax_id: cleanCpf,
                },
                store: false,
              },
            },
          },
        ],
        notification_urls: ['https://www.tipo7.com/api/webhooks/pagbank'],
      },
      orderId, // Idempotência
    )

    // Resposta síncrona — status de aprovação/recusa é imediato para cartão
    const pbStatus    = pbResponse.charges?.[0]?.status ?? 'DECLINED'
    const orderStatus = STATUS_MAP[pbStatus] ?? 'rejected'
    const chargeId    = pbResponse.charges?.[0]?.id ?? pbResponse.id

    await admin.from('orders').update({
      status:            orderStatus,
      gateway:           'pagbank',
      pagbank_charge_id: chargeId,
      updated_at:        new Date().toISOString(),
    }).eq('id', orderId)

    // Se aprovado imediatamente, emite ingressos e envia email
    if (orderStatus === 'approved') {
      await issueTickets(orderId, admin)
    }

    return NextResponse.json({ orderId, status: pbStatus })

  } catch (err) {
    if (err instanceof PagBankError) {
      console.error('[checkout/pagbank-card] PagBank error:', err.status, JSON.stringify(err.body))
      return NextResponse.json({ error: 'Pagamento recusado. Verifique os dados do cartão.' }, { status: 422 })
    }
    console.error('[checkout/pagbank-card]', JSON.stringify(err))
    return NextResponse.json({ error: 'Falha ao processar pagamento. Tente novamente.' }, { status: 500 })
  }
}
