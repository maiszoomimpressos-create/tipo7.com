import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isEventOwner } from '@/lib/eventPermissions'

// PATCH — edita um portão (nome, tipo, ativo)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; estacionamentoId: string; portaoId: string }> }
) {
  const { id, estacionamentoId, portaoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!(await isEventOwner(user.id, id))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as {
    nome?:  string
    tipo?:  'entrada' | 'saida' | 'ambos'
    ativo?: boolean
  }

  const admin = createServiceClient()

  const updates: Record<string, unknown> = {}
  if (body.nome !== undefined)  updates.nome  = body.nome.trim()
  if (body.tipo !== undefined)  updates.tipo  = body.tipo
  if (body.ativo !== undefined) updates.ativo = body.ativo

  const { error } = await admin
    .from('estacionamento_portoes')
    .update(updates)
    .eq('id', portaoId)
    .eq('estacionamento_id', estacionamentoId)

  if (error) return NextResponse.json({ error: 'Erro ao atualizar portão' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — remove um portão
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; estacionamentoId: string; portaoId: string }> }
) {
  const { id, estacionamentoId, portaoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!(await isEventOwner(user.id, id))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createServiceClient()

  const { error } = await admin
    .from('estacionamento_portoes')
    .delete()
    .eq('id', portaoId)
    .eq('estacionamento_id', estacionamentoId)

  if (error) return NextResponse.json({ error: 'Erro ao excluir portão' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
