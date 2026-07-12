import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const { eventoId, caixas, transferencia_requer_senha } = body as {
    eventoId: string
    caixas: { nome: string; fundo_inicial: number; ingressos_alocados: number; operador_id?: string }[]
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

  // Abre os caixas e retoma vendas online em uma transação
  const inserts = caixas.map(c => ({
    evento_id:          eventoId,
    operador_id:        c.operador_id ?? null,
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

  // Atualiza config do evento: retoma vendas + flag de transferência
  await admin
    .from('events')
    .update({ vendas_online_pausadas: false, transferencia_requer_senha })
    .eq('id', eventoId)

  return NextResponse.json({ caixas: criados })
}
