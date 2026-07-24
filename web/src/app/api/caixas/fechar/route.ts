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
  if (caixa.status === 'fechamento_pendente') return NextResponse.json({ error: 'Contagem já enviada, aguardando validação do organizador' }, { status: 400 })

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
  let totalDinheiroIngressos = 0

  if (orderIds.length > 0) {
    const { data: itens } = await admin.from('order_items').select('quantity').in('order_id', orderIds)
    vendidos = (itens ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0)
  }
  for (const o of orders ?? []) {
    if (o.payment_method === 'dinheiro') totalDinheiroIngressos += Number(o.total ?? 0)
  }

  // Sessões de estacionamento pagas neste caixa — reaproveita o mesmo fechamento de caixa
  const { data: sessoesEst } = await admin
    .from('estacionamento_sessoes')
    .select('valor_cobrado, forma_pagamento')
    .eq('caixa_id', caixaId)
    .eq('status', 'pago')

  let totalDinheiroEstacionamento = 0
  for (const s of sessoesEst ?? []) {
    if (s.forma_pagamento === 'dinheiro') totalDinheiroEstacionamento += Number(s.valor_cobrado ?? 0)
  }

  const totalDinheiro = totalDinheiroIngressos + totalDinheiroEstacionamento

  const ingressosEntregues = caixa.ingressos_alocados + recebidos - enviados
  const expectedGaveta     = Number(caixa.fundo_inicial) + totalDinheiro
  const diferenca_dinheiro  = expectedGaveta - dinheiro_contado
  const diferenca_ingressos = ingressosEntregues - vendidos - ingressos_devolvidos

  // Grava a contagem. Se quem está contando já é o dono do evento, fecha em
  // definitivo direto (não faz sentido o dono validar a própria contagem).
  // Se for o operador, fica aguardando o dono validar antes de fechar de
  // verdade — ninguém fecha em definitivo sozinho, é o dono quem recebe o
  // dinheiro físico das mãos do operador.
  const agora = new Date().toISOString()
  const [{ error: errFech }, { error: errCaixa }] = await Promise.all([
    admin.from('caixa_fechamento').insert({
      caixa_id:             caixaId,
      dinheiro_contado,
      ingressos_devolvidos,
      diferenca_dinheiro,
      diferenca_ingressos,
      observacoes,
      fechado_por:          user.id,
      ...(isOwner ? { validado_por: user.id, validado_em: agora } : {}),
    }),
    admin.from('caixas')
      .update(isOwner ? { status: 'fechado', fechado_em: agora } : { status: 'fechamento_pendente' })
      .eq('id', caixaId),
  ])

  if (errFech) return NextResponse.json({ error: errFech.message }, { status: 500 })
  if (errCaixa) return NextResponse.json({ error: errCaixa.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    pendente: !isOwner,
    apuracao: {
      fundo_inicial:        Number(caixa.fundo_inicial),
      total_dinheiro:       totalDinheiro,
      total_dinheiro_ingressos:      totalDinheiroIngressos,
      total_dinheiro_estacionamento: totalDinheiroEstacionamento,
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
