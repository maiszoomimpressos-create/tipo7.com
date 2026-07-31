import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isOrgAdmin } from '@/lib/orgAdmin'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: eventoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()

  const { data: evento } = await admin
    .from('events')
    .select('organization_id, vendas_online_pausadas, transferencia_requer_senha')
    .eq('id', eventoId)
    .single()
  if (!evento) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })

  if (!(await isOrgAdmin(admin, evento.organization_id, user.id)))
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { data: caixas } = await admin
    .from('caixas')
    .select('*')
    .eq('evento_id', eventoId)
    .order('created_at')

  // Busca nomes, código T7 e email dos operadores
  const operadorIds = [...new Set((caixas ?? []).map(c => c.operador_id).filter(Boolean))]
  const nomeMap:  Record<string, string> = {}
  const emailMap: Record<string, string> = {}
  const codeMap:  Record<string, string> = {}
  if (operadorIds.length > 0) {
    const { data: perfis } = await admin
      .from('profiles')
      .select('id, full_name, user_code')
      .in('id', operadorIds)
    for (const p of perfis ?? []) {
      nomeMap[p.id]  = p.full_name  ?? ''
      codeMap[p.id]  = p.user_code  ?? ''
    }
    const { data: emails } = await admin.rpc('get_user_emails', { p_ids: operadorIds })
    for (const u of (emails ?? []) as { id: string; email: string }[]) {
      emailMap[u.id] = u.email ?? ''
    }
  }

  // Nome do estacionamento vinculado (quando o caixa é de um local específico)
  const estacionamentoIds = [...new Set((caixas ?? []).map(c => c.estacionamento_id).filter(Boolean))]
  const estacionamentoNomeMap: Record<string, string> = {}
  if (estacionamentoIds.length > 0) {
    const { data: locais } = await admin.from('estacionamentos').select('id, nome').in('id', estacionamentoIds)
    for (const l of locais ?? []) estacionamentoNomeMap[l.id] = l.nome
  }

  const result = await Promise.all((caixas ?? []).map(async (c) => {
    const { data: trans } = await admin
      .from('caixa_transferencias')
      .select('caixa_origem_id, caixa_destino_id, quantidade')
      .or(`caixa_origem_id.eq.${c.id},caixa_destino_id.eq.${c.id}`)

    const recebidos = (trans ?? []).filter(t => t.caixa_destino_id === c.id).reduce((s, t) => s + t.quantidade, 0)
    const enviados  = (trans ?? []).filter(t => t.caixa_origem_id === c.id).reduce((s, t) => s + t.quantidade, 0)

    const { data: orders } = await admin
      .from('orders')
      .select('id, total, payment_method')
      .eq('caixa_id', c.id)
      .not('status', 'in', '(rejected,cancelled)')

    const orderIds = (orders ?? []).map(o => o.id)
    let vendidos = 0
    let totalDinheiro = 0; let totalPix = 0; let totalCartao = 0

    if (orderIds.length > 0) {
      const { data: itens } = await admin.from('order_items').select('quantity').in('order_id', orderIds)
      vendidos = (itens ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0)
    }
    for (const o of orders ?? []) {
      const v = Number(o.total ?? 0)
      if (o.payment_method === 'dinheiro') totalDinheiro += v
      else if (o.payment_method === 'pix')  totalPix += v
      else if (o.payment_method === 'cartao') totalCartao += v
    }

    return {
      ...c,
      operadorId:    c.operador_id ?? null,
      operadorName:  (c.operador_id ? nomeMap[c.operador_id] : null) ?? (c as { nome_operador?: string }).nome_operador ?? null,
      operadorEmail: c.operador_id ? (emailMap[c.operador_id] ?? null) : null,
      operadorCode:  c.operador_id ? (codeMap[c.operador_id]  ?? null) : null,
      estacionamentoNome: c.estacionamento_id ? (estacionamentoNomeMap[c.estacionamento_id] ?? null) : null,
      saldoIngressos: c.ingressos_alocados + recebidos - enviados - vendidos,
      vendidos, recebidos, enviados,
      totalDinheiro, totalPix, totalCartao,
      totalVendas: totalDinheiro + totalPix + totalCartao,
    }
  }))

  const { data: saldoBilheteria } = await admin
    .from('saldo_bilheteria')
    .select('ativo, saldo_atual, meta_reserva, aviso_disparado, bloqueio_ativo')
    .eq('event_id', eventoId)
    .maybeSingle()

  return NextResponse.json({
    caixas:                    result,
    vendas_online_pausadas:    evento.vendas_online_pausadas,
    transferencia_requer_senha: evento.transferencia_requer_senha,
    saldoBilheteria,
  })
}
