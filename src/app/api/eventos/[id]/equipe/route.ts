import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Verifica se o usuário logado é dono do evento
async function assertOwner(userId: string, eventoId: string) {
  const admin = createServiceClient()
  const { data: evento } = await admin
    .from('events')
    .select('organization_id')
    .eq('id', eventoId)
    .single()
  if (!evento) return false
  const { data: org } = await admin
    .from('organizations')
    .select('owner_id')
    .eq('id', evento.organization_id)
    .single()
  return org?.owner_id === userId
}

// GET /api/eventos/[id]/equipe — lista membros do evento
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const admin    = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!(await assertOwner(user.id, id))) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { data: staff } = await admin
    .from('event_staff')
    .select(`
      id, status, created_at,
      profiles:user_id (id, full_name),
      event_positions:event_position_id (id, name)
    `)
    .eq('event_id', id)
    .order('created_at')

  return NextResponse.json({ staff: staff ?? [] })
}

// POST /api/eventos/[id]/equipe — adiciona membro por email
// body: { email, positionName, permissions: string[] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const admin    = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!(await assertOwner(user.id, id))) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json() as {
    email:        string
    positionName: string
    permissions:  string[]
  }

  if (!body.email || !body.positionName) {
    return NextResponse.json({ error: 'Email e cargo são obrigatórios' }, { status: 400 })
  }

  // Busca o usuário pelo email
  const { data: { users } } = await admin.auth.admin.listUsers()
  const targetUser = users.find(u => u.email?.toLowerCase() === body.email.toLowerCase())

  if (!targetUser) {
    return NextResponse.json(
      { error: 'Usuário não encontrado. Ele precisa ter uma conta no Tipo7.' },
      { status: 404 }
    )
  }

  // Não pode adicionar a si mesmo
  if (targetUser.id === user.id) {
    return NextResponse.json(
      { error: 'Você já é o organizador deste evento.' },
      { status: 400 }
    )
  }

  // Cria o cargo (position) para esse membro
  const { data: position, error: posErr } = await admin
    .from('event_positions')
    .insert({ event_id: id, name: body.positionName.trim() })
    .select('id')
    .single()

  if (posErr || !position) {
    return NextResponse.json({ error: 'Erro ao criar cargo' }, { status: 500 })
  }

  // Salva as permissões do cargo
  if (body.permissions.length > 0) {
    await admin
      .from('event_position_permissions')
      .insert(
        body.permissions.map(p => ({
          event_position_id: position.id,
          permission:        p,
        }))
      )
  }

  // Cria o vínculo do membro com o evento
  const { error: staffErr } = await admin
    .from('event_staff')
    .upsert({
      event_id:          id,
      user_id:           targetUser.id,
      event_position_id: position.id,
      status:            'active',
      invited_by:        user.id,
    }, { onConflict: 'event_id,user_id' })

  if (staffErr) {
    return NextResponse.json({ error: staffErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/eventos/[id]/equipe?staffId=xxx — remove membro
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const staffId = req.nextUrl.searchParams.get('staffId')

  if (!staffId) return NextResponse.json({ error: 'staffId obrigatório' }, { status: 400 })

  const supabase = await createClient()
  const admin    = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!(await assertOwner(user.id, id))) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  await admin.from('event_staff').delete().eq('id', staffId).eq('event_id', id)

  return NextResponse.json({ ok: true })
}
