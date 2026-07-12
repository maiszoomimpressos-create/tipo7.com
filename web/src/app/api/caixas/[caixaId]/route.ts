import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface Params { params: Promise<{ caixaId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { caixaId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()

  const { data: caixa } = await admin
    .from('caixas')
    .select('*, events(title, date_start, venue_name, city, state, transferencia_requer_senha)')
    .eq('id', caixaId)
    .single()
  if (!caixa) return NextResponse.json({ error: 'Caixa não encontrado' }, { status: 404 })

  // Verifica acesso: dono do evento ou operador designado
  const evento = caixa.events as { title: string; date_start: string; venue_name: string; city: string; state: string; transferencia_requer_senha: boolean } | null
  const { data: org } = await admin
    .from('organizations')
    .select('owner_id')
    .eq('id', (await admin.from('events').select('organization_id').eq('id', caixa.evento_id).single()).data?.organization_id ?? '')
    .single()

  const isOwner   = org?.owner_id === user.id
  const isOperador = caixa.operador_id === user.id
  if (!isOwner && !isOperador)
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  // Calcula saldo de ingressos físicos
  const { data: transferencias } = await admin
    .from('caixa_transferencias')
    .select('caixa_origem_id, caixa_destino_id, quantidade')
    .or(`caixa_origem_id.eq.${caixaId},caixa_destino_id.eq.${caixaId}`)

  const recebidos = (transferencias ?? [])
    .filter(t => t.caixa_destino_id === caixaId)
    .reduce((s, t) => s + t.quantidade, 0)
  const enviados = (transferencias ?? [])
    .filter(t => t.caixa_origem_id === caixaId)
    .reduce((s, t) => s + t.quantidade, 0)

  // Vendas registradas neste caixa
  const { data: orders } = await admin
    .from('orders')
    .select('id, total, payment_method')
    .eq('caixa_id', caixaId)
    .not('status', 'in', '(rejected,cancelled)')

  const orderIds = (orders ?? []).map(o => o.id)
  let vendidos = 0
  let totalDinheiro = 0
  let totalPix = 0
  let totalCartao = 0

  if (orderIds.length > 0) {
    const { data: itens } = await admin
      .from('order_items')
      .select('quantity')
      .in('order_id', orderIds)
    vendidos = (itens ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0)
  }

  for (const o of orders ?? []) {
    const v = Number(o.total ?? 0)
    if (o.payment_method === 'dinheiro') totalDinheiro += v
    else if (o.payment_method === 'pix')  totalPix += v
    else if (o.payment_method === 'cartao') totalCartao += v
  }

  const saldoIngressos = caixa.ingressos_alocados + recebidos - enviados - vendidos

  return NextResponse.json({
    ...caixa,
    evento,
    saldoIngressos,
    vendidos,
    recebidos,
    enviados,
    totalDinheiro,
    totalPix,
    totalCartao,
    totalVendas: totalDinheiro + totalPix + totalCartao,
    expectedGaveta: Number(caixa.fundo_inicial) + totalDinheiro,
  })
}
