import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isEventOwner } from '@/lib/eventPermissions'

// PATCH /api/eventos/[id]/modulos
// Liga/desliga módulos de um evento já existente — funciona independente do status
// (rascunho ou já publicado), já que é só uma configuração, não algo que precisa
// passar por um novo fluxo de publicação.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!(await isEventOwner(user.id, id))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as {
    moduloIngressos?:      boolean
    moduloEstacionamento?: boolean
  }

  const admin = createServiceClient()

  const { data: atual } = await admin
    .from('events')
    .select('modulo_ingressos, modulo_estacionamento')
    .eq('id', id)
    .single()
  if (!atual) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })

  const novoIngressos      = body.moduloIngressos      ?? atual.modulo_ingressos
  const novoEstacionamento = body.moduloEstacionamento ?? atual.modulo_estacionamento

  if (!novoIngressos && !novoEstacionamento) {
    return NextResponse.json({ error: 'O evento precisa ter ao menos um módulo ativo' }, { status: 400 })
  }

  const { error } = await admin
    .from('events')
    .update({ modulo_ingressos: novoIngressos, modulo_estacionamento: novoEstacionamento })
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Erro ao atualizar módulos' }, { status: 500 })

  return NextResponse.json({ ok: true, moduloIngressos: novoIngressos, moduloEstacionamento: novoEstacionamento })
}
