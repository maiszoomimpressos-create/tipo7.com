// POST /api/webhooks/pagbank
// ─────────────────────────────────────────────────────────────────────────────
// Webhook do PagBank: recebe notificações de mudança de status de cobrança.
//
// Fluxo:
//   1. Verifica o segredo do header x-pagbank-notification-secret (se configurado)
//   2. Extrai reference_id (= orderId) e status da cobrança
//   3. Verifica idempotência na tabela processed_webhooks
//   4. Atualiza status do pedido em orders
//   5. Se aprovado: emite ingressos e envia email ao comprador
//   6. Retorna 200 sempre (PagBank requer 200 para não reenviar)
//
// Referência: https://dev.pagbank.uol.com.br/reference/notificacoes
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { issueTickets } from '@/lib/issueTickets'

// Mapeamento de status PagBank → status interno do sistema
const STATUS_MAP: Record<string, string> = {
  PAID:        'approved',
  AUTHORIZED:  'approved',
  IN_ANALYSIS: 'in_process',
  WAITING:     'pending',
  DECLINED:    'rejected',
  CANCELLED:   'cancelled',
}

// Estrutura do webhook recebido do PagBank
interface PagBankWebhookBody {
  // PagBank envia o reference_id no nível superior para PIX
  reference_id?: string
  charges?: Array<{
    id:           string
    reference_id?: string  // em alguns cenários vem no nível do charge
    status:       string
  }>
  // Para PIX, PagBank pode enviar no formato order com qr_codes
  order?: {
    reference_id?: string
  }
}

export async function POST(req: NextRequest) {
  // ── 1. Verificação do segredo do webhook ──────────────────────────────────
  // Valida o header de segurança enviado pelo PagBank em cada notificação.
  const webhookSecret = process.env.PAGBANK_WEBHOOK_SECRET
  if (webhookSecret) {
    const headerSecret = req.headers.get('x-pagbank-notification-secret') ?? ''
    if (headerSecret !== webhookSecret) {
      console.warn('[webhook/pagbank] segredo inválido — requisição rejeitada')
      return NextResponse.json({ error: 'Segredo inválido' }, { status: 401 })
    }
  }

  // ── 2. Parse do body ──────────────────────────────────────────────────────
  let body: PagBankWebhookBody
  try {
    body = await req.json()
  } catch {
    // Body inválido — retorna 200 para o PagBank não reenviar
    return NextResponse.json({ ok: true })
  }

  // Extrai orderId e status da cobrança
  // PagBank pode enviar o reference_id no nível superior ou dentro de charges[]
  const charge   = body.charges?.[0]
  const pbStatus = charge?.status
  const orderId  =
    body.reference_id ??
    charge?.reference_id ??
    body.order?.reference_id

  if (!orderId || !pbStatus) {
    // Webhook incompleto — retorna 200 para não reprocessar
    return NextResponse.json({ ok: true })
  }

  const chargeId  = charge?.id ?? orderId
  const newStatus = STATUS_MAP[pbStatus] ?? 'pending'

  const admin = createServiceClient()

  // ── 3. Idempotência ───────────────────────────────────────────────────────
  // Chave composta: charge_id + status para processar cada transição exatamente uma vez.
  // PagBank pode reenviar o mesmo webhook ou enviar múltiplas transições (WAITING → PAID).
  const { error: idempotencyError } = await admin
    .from('processed_webhooks')
    .insert({
      payment_id: chargeId,
      order_id:   orderId,
      gateway:    'pagbank',
      mp_status:  newStatus,  // usamos mp_status como campo genérico de status
    })

  if (idempotencyError) {
    if ((idempotencyError as { code?: string }).code === '23505') {
      // Webhook já processado — retorna 200 sem reprocessar
      console.log(`[webhook/pagbank] charge ${chargeId} status=${newStatus} já processado, ignorando`)
      return NextResponse.json({ ok: true })
    }
    // Erro inesperado na tabela de idempotência — registra mas continua
    console.error('[webhook/pagbank] erro em processed_webhooks (continuando):', idempotencyError)
  }

  // ── 4. Atualiza status do pedido ──────────────────────────────────────────
  await admin
    .from('orders')
    .update({
      status:            newStatus,
      pagbank_charge_id: chargeId,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', orderId)

  // ── 5. Emite ingressos se pagamento aprovado ──────────────────────────────
  if (newStatus === 'approved') {
    await issueTickets(orderId, admin)
  }

  return NextResponse.json({ ok: true })
}
