// Helper central de cálculo de taxa da plataforma.
// Cada "linha" de taxa (base + até 2 específicas) pode ser fixa (R$) ou percentual.
// application_fee = soma das linhas. A taxa do MP é cobrada por fora pelo próprio MP.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface FeeLine {
  type:  'fixed' | 'percent'
  value: number
}

export interface FeeConfig {
  base:      FeeLine
  extras:    FeeLine[]   // só as taxas específicas com valor > 0
  minFeePct: number      // piso mínimo (%) -- só vale quando a base é percentual
}

export interface CalcParams {
  eventoId:    string
  ownerId:     string | null
  total:       number       // valor de face do pedido em R$
  ticketCount: number       // quantidade de ingressos neste pedido
  config:      FeeConfig
  admin:       SupabaseClient
}

function valorLinha(linha: FeeLine, total: number): number {
  if (linha.type === 'percent') return Math.round(total * linha.value) / 100
  return Math.round(linha.value * 100) / 100
}

function valorFeeCompleto(config: FeeConfig, total: number): number {
  return valorLinha(config.base, total) + config.extras.reduce((s, e) => s + valorLinha(e, total), 0)
}

// Piso mínimo só se aplica quando a base é percentual -- uma taxa fixa já é um valor
// absoluto definido, não faz sentido compará-la com um piso percentual.
function aplicarPiso(valor: number, base: FeeLine, minFeePct: number, total: number, bypass: boolean): number {
  if (bypass || base.type !== 'percent') return valor
  const piso = Math.round(total * minFeePct) / 100
  return Math.max(valor, piso)
}

function comDesconto(valorNormal: number, discountPct: number): number {
  return Math.round(valorNormal * (1 - discountPct / 100) * 100) / 100
}

// Lê a config de taxa de Ingressos on-line (Financeiro > Tarifas) direto de
// platform_settings -- chaves sem prefixo. É essa config que vale de verdade
// pro checkout agora, no lugar da taxa individual do promotor.
export async function buscarConfigTaxaIngressosOnline(admin: SupabaseClient): Promise<FeeConfig> {
  const { data: settings } = await admin
    .from('platform_settings')
    .select('key, value')
    .in('key', [
      'default_fee_pct', 'default_fee_type', 'min_fee_pct',
      'extra_fee_1_value', 'extra_fee_1_type',
      'extra_fee_2_value', 'extra_fee_2_type',
    ])

  const map: Record<string, string> = {}
  for (const s of settings ?? []) map[s.key] = s.value

  const base: FeeLine = {
    type:  (map.default_fee_type as 'fixed' | 'percent') ?? 'percent',
    value: Number(map.default_fee_pct ?? 10),
  }

  const extra1Value = Number(map.extra_fee_1_value ?? 0)
  const extra2Value = Number(map.extra_fee_2_value ?? 0)
  const extras: FeeLine[] = [
    extra1Value > 0 ? { type: (map.extra_fee_1_type as 'fixed' | 'percent') ?? 'percent', value: extra1Value } : null,
    extra2Value > 0 ? { type: (map.extra_fee_2_type as 'fixed' | 'percent') ?? 'percent', value: extra2Value } : null,
  ].filter((l): l is FeeLine => l !== null)

  return { base, extras, minFeePct: Number(map.min_fee_pct ?? 0) }
}

// Retorna o valor em R$ da taxa da plataforma após aplicar regras de isenção.
export async function calcularTaxaPlataforma(p: CalcParams): Promise<number> {
  const { eventoId, ownerId, total, ticketCount, config, admin } = p

  // ── 1. Regra por evento específico ────────────────────────────────────────
  const { data: regraEvento } = await admin
    .from('fee_rules')
    .select('discount_pct, bypass_minimum, fee_type, fee_value, extra_fee_1_value, extra_fee_1_type, extra_fee_2_value, extra_fee_2_type')
    .eq('type', 'event')
    .eq('event_id', eventoId)
    .eq('active', true)
    .maybeSingle()

  if (regraEvento) {
    // Regra nova: taxa inteira customizada pro evento (substitui a config geral).
    if (regraEvento.fee_value !== null && regraEvento.fee_type) {
      const eventBase: FeeLine = { type: regraEvento.fee_type as 'fixed' | 'percent', value: Number(regraEvento.fee_value) }
      const eventExtras: FeeLine[] = [
        regraEvento.extra_fee_1_value ? { type: regraEvento.extra_fee_1_type as 'fixed' | 'percent', value: Number(regraEvento.extra_fee_1_value) } : null,
        regraEvento.extra_fee_2_value ? { type: regraEvento.extra_fee_2_type as 'fixed' | 'percent', value: Number(regraEvento.extra_fee_2_value) } : null,
      ].filter((l): l is FeeLine => l !== null)

      const valor = valorFeeCompleto({ base: eventBase, extras: eventExtras, minFeePct: config.minFeePct }, total)
      return aplicarPiso(valor, eventBase, config.minFeePct, total, regraEvento.bypass_minimum)
    }

    // Legado: desconto percentual sobre a config geral.
    const valor = comDesconto(valorFeeCompleto(config, total), Number(regraEvento.discount_pct))
    return aplicarPiso(valor, config.base, config.minFeePct, total, regraEvento.bypass_minimum)
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
        const valor = comDesconto(valorFeeCompleto(config, total), Number(regraPromotor.discount_pct))
        return aplicarPiso(valor, config.base, config.minFeePct, total, regraPromotor.bypass_minimum)
      }
    }
  }

  // ── 3. Quota global da plataforma ─────────────────────────────────────────
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
      const valor = comDesconto(valorFeeCompleto(config, total), Number(regraGlobal.discount_pct))
      return aplicarPiso(valor, config.base, config.minFeePct, total, regraGlobal.bypass_minimum)
    }
  }

  // ── 4. Taxa normal sem desconto ──────────────────────────────────────────
  return aplicarPiso(valorFeeCompleto(config, total), config.base, config.minFeePct, total, false)
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
