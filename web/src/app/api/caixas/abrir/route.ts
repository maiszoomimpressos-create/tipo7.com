import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const { eventoId, caixas, transferencia_requer_senha } = body as {
    eventoId: string
    caixas: {
      nome:               string
      fundo_inicial:      number
      ingressos_alocados: number
      operadorId?:        string
      funcaoId?:          string | null
      nomeOperador?:      string
    }[]
    transferencia_requer_senha: boolean
  }

  if (!eventoId || !Array.isArray(caixas) || caixas.length === 0)
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const admin = createServiceClient()

  // Verifica se é dono do evento
  const { data: evento } = await admin
    .from('events')
    .select('id, organization_id')
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

  // Valida nomes únicos dentro do lote
  const nomesLote = caixas.map(c => c.nome.trim())
  if (new Set(nomesLote).size !== nomesLote.length)
    return NextResponse.json({ error: 'Cada caixa deve ter um nome único.' }, { status: 400 })

  // Valida conflito de nome com caixas já abertas
  const { data: caixasExistentes } = await admin
    .from('caixas')
    .select('nome')
    .eq('evento_id', eventoId)
    .eq('status', 'aberto')
  const nomesAbertos = new Set((caixasExistentes ?? []).map((c: { nome: string }) => c.nome))
  for (const nome of nomesLote) {
    if (nomesAbertos.has(nome))
      return NextResponse.json({ error: `Já existe um caixa aberto chamado "${nome}". Escolha um nome diferente.` }, { status: 400 })
  }

  // Valida operadores únicos (ninguém pode operar 2 caixas ao mesmo tempo)
  const operadoresLote = caixas.filter(c => c.operadorId).map(c => c.operadorId!)
  if (new Set(operadoresLote).size !== operadoresLote.length)
    return NextResponse.json({ error: 'Um operador não pode operar dois caixas ao mesmo tempo.' }, { status: 400 })

  if (operadoresLote.length > 0) {
    const { data: caixasComOp } = await admin
      .from('caixas')
      .select('nome, operador_id')
      .eq('evento_id', eventoId)
      .eq('status', 'aberto')
      .in('operador_id', operadoresLote)
    if ((caixasComOp ?? []).length > 0) {
      const conflito = (caixasComOp as { nome: string }[])[0]
      return NextResponse.json({ error: `Um dos operadores já está operando o caixa "${conflito.nome}".` }, { status: 400 })
    }
  }

  // Cria os caixas
  const inserts = caixas.map(c => ({
    evento_id:          eventoId,
    operador_id:        c.operadorId ?? null,
    nome_operador:      c.nomeOperador ?? null,
    nome:               c.nome,
    fundo_inicial:      c.fundo_inicial,
    ingressos_alocados: c.ingressos_alocados,
    created_by:         user.id,
  }))

  const { data: criados, error } = await admin
    .from('caixas')
    .insert(inserts)
    .select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Cria convites de equipe para operadores cadastrados
  for (const c of caixas) {
    if (c.operadorId && c.funcaoId) {
      await admin.from('event_staff').upsert({
        event_id:          eventoId,
        user_id:           c.operadorId,
        event_position_id: c.funcaoId,
        status:            'pending',
        invited_by:        user.id,
      }, { onConflict: 'event_id,user_id' })
    }
  }

  // Retoma vendas + atualiza flag de transferência
  await admin
    .from('events')
    .update({ vendas_online_pausadas: false, transferencia_requer_senha })
    .eq('id', eventoId)

  return NextResponse.json({ caixas: criados })
}
