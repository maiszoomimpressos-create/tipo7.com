// Helper central de cálculo de taxa da plataforma.
// Verifica se existe alguma regra de isenção/desconto que se aplica ao checkout
// antes de calcular a taxa final cobrada pelo Tipo7.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface CalcParams {
  eventoId:          string
  ownerId:           string | null
  total:             number       // valor de face do pedido em R$
  ticketCount:       number       // quantidade de ingressos neste pedido
  feePct:            number       // taxa total cobrada do promotor (0–100), ex: 12
  minFeePct:         number       // taxa mínima da plataforma mesmo com desconto (0–100)
  admin:             SupabaseClient
  // Modelo B — 12% tudo incluso (MP absorvido pela plataforma)
  // Quando informados, ajusta application_fee para que total descontado = feePct% do valor de face
  mpFeePct?:         number       // taxa de processamento MP para este método (ex: 0.99 para PIX)
  transactionAmount?: number      // valor real cobrado do comprador (inclui juros de parcelamento)
}

// Converte um effectivePct% em application_fee (R$).
// Modelo B: ajusta para que application_fee + mpFee = effectivePct% do valor de face.
// Modelo A (legado): application_fee = effectivePct% do valor de face.
function toApplicationFee(
  effectivePct:      number,
  total:             number,
  mpFeePct?:         number,
  transactionAmount?: number,
): number {
  if (mpFeePct !== undefined && transactionAmount !== undefined) {
    // Garante que promotor receba exatamente (100 − effectivePct)% do valor de face
    const fee = transactionAmount * (1 - mpFeePct / 100) - total * (1 - effectivePct / 100)
    return Math.max(0, Math.round(fee * 100) / 100)
  }
  return Math.round(total * effectivePct) / 100
}

// Retorna o valor em R$ da taxa da plataforma após aplicar regras de isenção.
export async function calcularTaxaPlataforma(p: CalcParams): Promise<number> {
  const { eventoId, ownerId, total, ticketCount, feePct, minFeePct, admin, mpFeePct, transactionAmount } = p

  // Taxa mínima em R$ — nunca cai abaixo disso, mesmo com isenção total
  const taxaMinima = Math.round(total * minFeePct) / 100

  // ── 1. Isenção por evento específico ──────────────────────────────────────
  const { data: regraEvento } = await admin
    .from('fee_rules')
    .select('discount_pct, bypass_minimum')
    .eq('type', 'event')
    .eq('event_id', eventoId)
    .eq('active', true)
    .maybeSingle()

  if (regraEvento) {
    const pctEfetivo = feePct * (1 - Number(regraEvento.discount_pct) / 100)
    const taxa = toApplicationFee(pctEfetivo, total, mpFeePct, transactionAmount)
    return regraEvento.bypass_minimum ? taxa : Math.max(taxa, taxaMinima)
  }

  // ── 2. Quota por promotor (ex.: primeiros 100 ingressos do mês) ───────────
  if (ownerId) {
    const { data: regraPromotor } = await admin
      .from('fee_rules')
      .select('discount_pct, quota_limit, quota_period, bypass_minimum')
      .eq('type', 'promoter_quota')
      .eq('user_id', ownerId)
      .eq('active', true)
      .maybeSingle()

    if (regraPromotor?.quota_limit) {
      const usados = await contarTicketsPromotor(admin, ownerId, regraPromotor.quota_period)
      const restam = regraPromotor.quota_limit - usados
      if (restam >= ticketCount) {
        const pctEfetivo = feePct * (1 - Number(regraPromotor.discount_pct) / 100)
        const taxa = toApplicationFee(pctEfetivo, total, mpFeePct, transactionAmount)
        return regraPromotor.bypass_minimum ? taxa : Math.max(taxa, taxaMinima)
      }
    }
  }

  // ── 3. Quota global da plataforma (ex.: primeiros 100 ingressos do sistema) ─
  const { data: regraGlobal } = await admin
    .from('fee_rules')
    .select('discount_pct, quota_limit, quota_period, bypass_minimum')
    .eq('type', 'global_quota')
    .eq('active', true)
    .maybeSingle()

  if (regraGlobal?.quota_limit) {
    const usados = await contarTicketsGlobal(admin, regraGlobal.quota_period)
    const restam = regraGlobal.quota_limit - usados
    if (restam >= ticketCount) {
      const pctEfetivo = feePct * (1 - Number(regraGlobal.discount_pct) / 100)
      const taxa = toApplicationFee(pctEfetivo, total, mpFeePct, transactionAmount)
      return regraGlobal.bypass_minimum ? taxa : Math.max(taxa, taxaMinima)
    }
  }

  // ── 4. Taxa normal sem desconto ──────────────────────────────────────────
  return toApplicationFee(feePct, total, mpFeePct, transactionAmount)
}

// ── Helpers de contagem ───────────────────────────────────────────────────────

async function contarTicketsPromotor(
  admin:  SupabaseClient,
  userId: string,
  period: string | null,
): Promise<number> {
  const desde = periodoInicio(period)

  const { data: orgs } = await admin
    .from('organizations').select('id').eq('owner_id', userId)
  const orgIds = (orgs ?? []).map(o => o.id)
  if (!orgIds.length) return 0

  const { data: events } = await admin
    .from('events').select('id').in('organization_id', orgIds)
  const eventIds = (events ?? []).map(e => e.id)
  if (!eventIds.length) return 0

  const { data: orders } = await admin
    .from('orders').select('id')
    .in('event_id', eventIds).eq('status', 'approved').gte('created_at', desde)
  const orderIds = (orders ?? []).map(o => o.id)
  if (!orderIds.length) return 0

  const { data: items } = await admin
    .from('order_items').select('quantity').in('order_id', orderIds)
  return (items ?? []).reduce((s, i) => s + i.quantity, 0)
}

async function contarTicketsGlobal(
  admin:  SupabaseClient,
  period: string | null,
): Promise<number> {
  const desde = periodoInicio(period)

  const { data: orders } = await admin
    .from('orders').select('id').eq('status', 'approved').gte('created_at', desde)
  const orderIds = (orders ?? []).map(o => o.id)
  if (!orderIds.length) return 0

  const { data: items } = await admin
    .from('order_items').select('quantity').in('order_id', orderIds)
  return (items ?? []).reduce((s, i) => s + i.quantity, 0)
}

function periodoInicio(period: string | null): string {
  if (period === 'monthly') {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  }
  return '2000-01-01T00:00:00Z'
}
