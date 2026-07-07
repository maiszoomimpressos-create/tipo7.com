import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function assertOwner(userId: string, eventoId: string) {
  const admin = createServiceClient()
  const { data: evento } = await admin.from('events').select('organization_id').eq('id', eventoId).single()
  if (!evento) return false
  const { data: org } = await admin.from('organizations').select('owner_id').eq('id', evento.organization_id).single()
  return org?.owner_id === userId
}

// DELETE — remove função (só se não houver membros ativos com ela)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; funcaoId: string }> }
) {
  const { id, funcaoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!(await assertOwner(user.id, id))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createServiceClient()

  const { count } = await admin
    .from('event_staff')
    .select('id', { count: 'exact', head: true })
    .eq('event_position_id', funcaoId)
    .in('status', ['pending', 'active'])

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Não é possível excluir uma função com membros ativos ou pendentes.' },
      { status: 409 }
    )
  }

  await admin.from('event_positions').delete().eq('id', funcaoId).eq('event_id', id)
  return NextResponse.json({ ok: true })
}

// PATCH — atualiza nome e permissões de uma função
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; funcaoId: string }> }
) {
  const { id, funcaoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!(await assertOwner(user.id, id))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { nome, permissoes } = await req.json() as { nome?: string; permissoes?: string[] }
  const admin = createServiceClient()

  if (nome?.trim()) {
    await admin.from('event_positions').update({ name: nome.trim() }).eq('id', funcaoId).eq('event_id', id)
  }

  if (permissoes !== undefined) {
    await admin.from('event_position_permissions').delete().eq('event_position_id', funcaoId)
    if (permissoes.length > 0) {
      await admin.from('event_position_permissions').insert(
        permissoes.map(p => ({ event_position_id: funcaoId, permission: p }))
      )
    }
  }

  return NextResponse.json({ ok: true })
}
