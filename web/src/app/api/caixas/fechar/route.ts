import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { caixaId, dinheiro_contado, ingressos_devolvidos, observacoes } = await req.json() as {
    caixaId:              string
    dinheiro_contado:     number
    ingressos_devolvidos: number
    observacoes?:         string
  }

  if (!caixaId) return NextResponse.json({ error: 'caixaId obrigatório' }, { status: 400 })

  const admin = createServiceClient()

  const { data: caixa } = await admin
    .from('caixas')
    .select('*, events(organization_id)')
    .eq('id', caixaId)
    .single()
  if (!caixa) return NextResponse.json({ error: 'Caixa não encontrado' }, { status: 404 })
  if (caixa.status === 'fechado') return NextResponse.json({ error: 'Caixa já fechado' }, { status: 400 })

  const evento = caixa.events as { organization_id: string } | null
  const { data: org } = await admin
    .from('organizations')
    .select('owner_id')
    .eq('id', evento?.organization_id ?? '')
    .single()

  const isOwner    = org?.owner_id === user.id
  const isOperador = caixa.operador_id === user.id
  if (!isOwner && !isOperador)
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  // Calcula saldo de ingressos
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

  const { data: orders } = await admin
    .from('orders')
    .select('id, total, payment_method')
    .eq('caixa_id', caixaId)
    .not('status', 'in', '(rejected,cancelled)')

  const orderIds = (orders ?? []).map(o => o.id)
  let vendidos = 0
  let totalDinheiro = 0

  if (orderIds.length > 0) {
    const { data: itens } = await admin.from('order_items').select('quantity').in('order_id', orderIds)
    vendidos = (itens ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0)
  }
  for (const o of orders ?? []) {
    if (o.payment_method === 'dinheiro') totalDinheiro += Number(o.total ?? 0)
  }

  const ingressosEntregues = caixa.ingressos_alocados + recebidos - enviados
  const expectedGaveta     = Number(caixa.fundo_inicial) + totalDinheiro
  const diferenca_dinheiro  = expectedGaveta - dinheiro_contado
  const diferenca_ingressos = ingressosEntregues - vendidos - ingressos_devolvidos

  // Grava fechamento e fecha o caixa
  const [{ error: errFech }, { error: errCaixa }] = await Promise.all([
    admin.from('caixa_fechamento').insert({
      caixa_id:             caixaId,
      dinheiro_contado,
      ingressos_devolvidos,
      diferenca_dinheiro,
      diferenca_ingressos,
      observacoes,
      fechado_por:          user.id,
    }),
    admin.from('caixas').update({ status: 'fechado', fechado_em: new Date().toISOString() }).eq('id', caixaId),
  ])

  if (errFech) return NextResponse.json({ error: errFech.message }, { status: 500 })
  if (errCaixa) return NextResponse.json({ error: errCaixa.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    apuracao: {
      fundo_inicial:        Number(caixa.fundo_inicial),
      total_dinheiro:       totalDinheiro,
      expected_gaveta:      expectedGaveta,
      dinheiro_contado,
      diferenca_dinheiro,
      ingressos_alocados:   caixa.ingressos_alocados,
      recebidos,
      enviados,
      vendidos,
      ingressos_devolvidos,
      diferenca_ingressos,
    },
  })
}
