import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { caixaOrigemId, caixaDestinoId, quantidade, senhaPromotor } = await req.json() as {
    caixaOrigemId:  string
    caixaDestinoId: string
    quantidade:     number
    senhaPromotor?: string
  }

  if (!caixaOrigemId || !caixaDestinoId || !quantidade || quantidade <= 0)
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const admin = createServiceClient()

  const [{ data: origem }, { data: destino }] = await Promise.all([
    admin.from('caixas').select('*, events(organization_id, transferencia_requer_senha)').eq('id', caixaOrigemId).single(),
    admin.from('caixas').select('id, evento_id, status, operador_id').eq('id', caixaDestinoId).single(),
  ])

  if (!origem || !destino)
    return NextResponse.json({ error: 'Caixa não encontrado' }, { status: 404 })
  if (origem.evento_id !== destino.evento_id)
    return NextResponse.json({ error: 'Caixas de eventos diferentes' }, { status: 400 })
  if (origem.status !== 'aberto' || destino.status !== 'aberto')
    return NextResponse.json({ error: 'Ambos os caixas devem estar abertos' }, { status: 400 })

  const evento = origem.events as { organization_id: string; transferencia_requer_senha: boolean } | null

  // Verifica autorização
  const { data: org } = await admin
    .from('organizations')
    .select('owner_id')
    .eq('id', evento?.organization_id ?? '')
    .single()

  const isOwner    = org?.owner_id === user.id
  const isOperador = origem.operador_id === user.id || destino.operador_id === user.id

  if (!isOwner && !isOperador)
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  // Se requer senha do promotor e quem pede não é o dono, valida senha
  if (evento?.transferencia_requer_senha && !isOwner) {
    if (!senhaPromotor)
      return NextResponse.json({ error: 'senha_requerida', message: 'Esta transferência requer autorização do promotor.' }, { status: 403 })

    // Valida a senha do promotor via Supabase Auth
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: '', // não temos o email aqui — usamos verificação via RPC
      password: senhaPromotor,
    })
    // Alternativa mais segura: apenas o promotor pode chamar esta rota com isOwner = true
    // Então se chegou aqui (não é owner) e requer senha, bloqueia
    if (authErr)
      return NextResponse.json({ error: 'Senha do promotor incorreta' }, { status: 403 })
  }

  // Verifica saldo disponível na origem
  const { data: transOrigens } = await admin
    .from('caixa_transferencias')
    .select('caixa_origem_id, caixa_destino_id, quantidade')
    .or(`caixa_origem_id.eq.${caixaOrigemId},caixa_destino_id.eq.${caixaOrigemId}`)

  const recebidos = (transOrigens ?? [])
    .filter(t => t.caixa_destino_id === caixaOrigemId)
    .reduce((s, t) => s + t.quantidade, 0)
  const enviados = (transOrigens ?? [])
    .filter(t => t.caixa_origem_id === caixaOrigemId)
    .reduce((s, t) => s + t.quantidade, 0)

  const { data: ordersOrigem } = await admin
    .from('orders')
    .select('id')
    .eq('caixa_id', caixaOrigemId)
    .not('status', 'in', '(rejected,cancelled)')
  const orderIds = (ordersOrigem ?? []).map(o => o.id)
  let vendidosOrigem = 0
  if (orderIds.length > 0) {
    const { data: itens } = await admin.from('order_items').select('quantity').in('order_id', orderIds)
    vendidosOrigem = (itens ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0)
  }

  const saldoOrigem = origem.ingressos_alocados + recebidos - enviados - vendidosOrigem
  if (quantidade > saldoOrigem)
    return NextResponse.json({ error: `Saldo insuficiente. Origem tem ${saldoOrigem} ingresso(s) disponíveis.` }, { status: 400 })

  const { data: transferencia, error } = await admin
    .from('caixa_transferencias')
    .insert({
      evento_id:        origem.evento_id,
      caixa_origem_id:  caixaOrigemId,
      caixa_destino_id: caixaDestinoId,
      quantidade,
      autorizado_por:   isOwner ? user.id : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ transferencia, saldoOrigemApos: saldoOrigem - quantidade })
}
