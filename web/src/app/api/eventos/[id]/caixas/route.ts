import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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

  const { data: org } = await admin
    .from('organizations')
    .select('owner_id')
    .eq('id', evento.organization_id)
    .single()
  if (org?.owner_id !== user.id)
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { data: caixas } = await admin
    .from('caixas')
    .select('*, profiles(full_name)')
    .eq('evento_id', eventoId)
    .order('created_at')

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
      operadorName: (c.profiles as { full_name: string } | null)?.full_name ?? null,
      saldoIngressos: c.ingressos_alocados + recebidos - enviados - vendidos,
      vendidos, recebidos, enviados,
      totalDinheiro, totalPix, totalCartao,
      totalVendas: totalDinheiro + totalPix + totalCartao,
    }
  }))

  return NextResponse.json({
    caixas:                    result,
    vendas_online_pausadas:    evento.vendas_online_pausadas,
    transferencia_requer_senha: evento.transferencia_requer_senha,
  })
}
