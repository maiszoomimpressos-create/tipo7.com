import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isEventOwner } from '@/lib/eventPermissions'

// POST — cria um portão (ponto de entrada/saída) num estacionamento
// body: { nome, tipo: 'entrada'|'saida'|'ambos' }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; estacionamentoId: string }> }
) {
  const { id, estacionamentoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!(await isEventOwner(user.id, id))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as { nome: string; tipo: 'entrada' | 'saida' | 'ambos' }

  if (!body.nome?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  if (!['entrada', 'saida', 'ambos'].includes(body.tipo)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  const admin = createServiceClient()

  // Confirma que o estacionamento pertence a este evento
  const { data: estacionamento } = await admin
    .from('estacionamentos')
    .select('id')
    .eq('id', estacionamentoId)
    .eq('event_id', id)
    .single()
  if (!estacionamento) return NextResponse.json({ error: 'Estacionamento não encontrado' }, { status: 404 })

  const { data: criado, error } = await admin
    .from('estacionamento_portoes')
    .insert({ estacionamento_id: estacionamentoId, nome: body.nome.trim(), tipo: body.tipo })
    .select()
    .single()

  if (error || !criado) return NextResponse.json({ error: 'Erro ao criar portão' }, { status: 500 })

  return NextResponse.json({ ok: true, portao: criado })
}
