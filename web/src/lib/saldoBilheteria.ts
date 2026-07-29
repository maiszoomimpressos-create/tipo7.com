// Saldo de bilheteria: reserva formada com uma contribuição extra em cada venda
// online, pra cobrir a taxa da plataforma nas vendas presenciais (dinheiro/
// maquininha do promotor), que não tem como ser descontada automaticamente.
// O cálculo de taxa em si (fixo/%, regras por evento/promotor/quota) é sempre
// feito por calcularTaxaPlataforma -- aqui só orquestra a reserva/livro-razão.
import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularTaxaPlataforma, buscarConfigTaxaIngressosOnline } from './feeRules'

export interface SaldoBilheteria {
  ativo:           boolean
  bloqueio_ativo:  boolean
  retencao_pct:    number
  aviso_pct:       number
  meta_reserva:    number
  saldo_atual:     number
  aviso_disparado: boolean
}

export function calcularContribuicaoSaldo(total: number, taxaNormal: number, retencaoPct: number): number {
  const sobra = Math.max(0, total - taxaNormal)
  return Math.round(sobra * retencaoPct) / 100
}

export async function buscarSaldoBilheteria(admin: SupabaseClient, eventId: string): Promise<SaldoBilheteria | null> {
  const { data } = await admin
    .from('saldo_bilheteria')
    .select('ativo, bloqueio_ativo, retencao_pct, aviso_pct, meta_reserva, saldo_atual, aviso_disparado')
    .eq('event_id', eventId)
    .maybeSingle()
  return data ?? null
}

// Soma a taxa devida sobre os ingressos ainda não vendidos do evento --
// usada tanto na ativação inicial quanto no recálculo após cada venda online.
export async function calcularMetaReserva(admin: SupabaseClient, eventId: string): Promise<number> {
  const [{ data: tickets }, { data: eventInfo }] = await Promise.all([
    admin.from('event_tickets').select('id, price, quantity').eq('event_id', eventId),
    admin.from('events').select('organization_id, organizations(owner_id)').eq('id', eventId).single(),
  ])
  if (!tickets?.length) return 0

  const orgRaw  = eventInfo?.organizations as unknown
  const orgData = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as { owner_id: string } | null
  const ownerId = orgData?.owner_id ?? null

  const config = await buscarConfigTaxaIngressosOnline(admin)

  const { data: orders } = await admin.from('orders').select('id, status').eq('event_id', eventId)
  const validOrderIds = (orders ?? [])
    .filter(o => o.status !== 'rejected' && o.status !== 'cancelled')
    .map(o => o.id)

  const vendidosPorTicket: Record<string, number> = {}
  if (validOrderIds.length) {
    const { data: orderItems } = await admin
      .from('order_items').select('ticket_id, quantity').in('order_id', validOrderIds)
    for (const oi of orderItems ?? []) {
      vendidosPorTicket[oi.ticket_id] = (vendidosPorTicket[oi.ticket_id] ?? 0) + oi.quantity
    }
  }

  let meta = 0
  for (const ticket of tickets) {
    const vendidos  = vendidosPorTicket[ticket.id] ?? 0
    const restante  = Math.max(0, ticket.quantity - vendidos)
    const precoTotal = restante * Number(ticket.price ?? 0)
    if (restante === 0 || precoTotal <= 0) continue

    meta += await calcularTaxaPlataforma({
      eventoId:    eventId,
      ownerId,
      total:       precoTotal,
      ticketCount: restante,
      config,
      admin,
    })
  }

  return Math.round(meta * 100) / 100
}

export async function ativarSaldoBilheteria(
  admin:   SupabaseClient,
  eventId: string,
  userId:  string,
): Promise<{ ok: boolean; error?: string }> {
  const meta = await calcularMetaReserva(admin, eventId)
  const { data, error } = await admin.rpc('ativar_saldo_bilheteria', {
    p_event_id: eventId,
    p_user_id:  userId,
    p_meta_reserva: meta,
  })
  if (error) return { ok: false, error: error.message }
  if (data?.error) return { ok: false, error: data.error }
  return { ok: true }
}

// Chamar depois de confirmar uma venda ONLINE, se buscarSaldoBilheteria(...).ativo.
export async function incrementarSaldoBilheteria(
  admin:      SupabaseClient,
  eventId:    string,
  orderId:    string,
  valorExtra: number,
): Promise<void> {
  if (valorExtra <= 0) return
  const novaMeta = await calcularMetaReserva(admin, eventId)
  await admin.rpc('incrementar_saldo_bilheteria', {
    p_event_id:    eventId,
    p_order_id:    orderId,
    p_valor_extra: valorExtra,
    p_nova_meta:   novaMeta,
  })
}

// Chamada pelo webhook do Mercado Pago quando um pedido ONLINE é aprovado de
// verdade (nunca na criação da cobrança -- carrinho abandonado/pix expirado não
// pode inflar o saldo com dinheiro que nunca chegou). Pedidos de bilheteria têm
// caixa_id preenchido e são ignorados aqui -- eles debitam na própria rota,
// de forma síncrona, porque lá a venda já é definitiva no momento da chamada.
export async function processarSaldoAposAprovacao(admin: SupabaseClient, orderId: string): Promise<void> {
  const { data: order } = await admin
    .from('orders').select('event_id, total, caixa_id').eq('id', orderId).single()
  if (!order?.event_id || order.caixa_id) return

  const saldo = await buscarSaldoBilheteria(admin, order.event_id)
  if (!saldo?.ativo) return

  const { data: eventInfo } = await admin
    .from('events').select('organization_id, organizations(owner_id)').eq('id', order.event_id).single()
  const orgRaw  = eventInfo?.organizations as unknown
  const orgData = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as { owner_id: string } | null
  const ownerId = orgData?.owner_id ?? null

  const { data: items } = await admin.from('order_items').select('quantity').eq('order_id', orderId)
  const ticketCount = (items ?? []).reduce((s, i) => s + i.quantity, 0)
  if (!ticketCount) return

  const config     = await buscarConfigTaxaIngressosOnline(admin)
  const taxaNormal = await calcularTaxaPlataforma({
    eventoId: order.event_id, ownerId, total: Number(order.total), ticketCount, config, admin,
  })
  const extra = calcularContribuicaoSaldo(Number(order.total), taxaNormal, saldo.retencao_pct)
  if (extra > 0) await incrementarSaldoBilheteria(admin, order.event_id, orderId, extra)
}

// Chamar antes de confirmar uma venda de BILHETERIA (dinheiro ou pix presencial).
// Retorna bloqueado:true quando o saldo está insuficiente e o bloqueio está ligado.
export async function debitarSaldoBilheteria(
  admin:   SupabaseClient,
  eventId: string,
  valor:   number,
  orderId: string,
): Promise<{ bloqueado: boolean; saldoAtual?: number }> {
  const { data, error } = await admin.rpc('debitar_saldo_bilheteria', {
    p_event_id: eventId,
    p_valor:    valor,
    p_order_id: orderId,
  })
  if (error) return { bloqueado: false }
  if (data?.error === 'saldo_insuficiente') return { bloqueado: true, saldoAtual: Number(data.saldo_atual) }
  return { bloqueado: false, saldoAtual: data?.saldo_atual !== undefined ? Number(data.saldo_atual) : undefined }
}
