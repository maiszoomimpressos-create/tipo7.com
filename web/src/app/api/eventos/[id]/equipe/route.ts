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
      id, status, created_at, user_id, portao_id,
      profiles:user_id (id, full_name, user_code),
      event_positions:event_position_id (id, name, event_position_permissions(permission)),
      estacionamento_portoes:portao_id (id, nome)
    `)
    .eq('event_id', id)
    .order('created_at')

  // Busca emails dos membros via Auth
  const userIds = (staff ?? []).map((s: { user_id: string }) => s.user_id)
  const emailMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    for (const u of users) {
      if (userIds.includes(u.id)) emailMap[u.id] = u.email ?? ''
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffComEmail = (staff ?? []).map((s: any) => ({
    ...s,
    email:    emailMap[s.user_id] ?? null,
    userCode: (Array.isArray(s.profiles) ? s.profiles[0] : s.profiles)?.user_code ?? null,
  }))

  return NextResponse.json({ staff: staffComEmail })
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
    emailOuCodigo: string
    funcaoId:      string   // ID de uma função já criada no evento
    portaoId?:     string   // opcional — restringe o membro a um portão específico
  }

  if (!body.emailOuCodigo || !body.funcaoId) {
    return NextResponse.json({ error: 'Email/código e função são obrigatórios' }, { status: 400 })
  }

  const busca = body.emailOuCodigo.trim()

  // Busca por código T7 (direto na tabela profiles) ou por email (Auth)
  let targetUserId: string | null = null

  if (busca.toUpperCase().startsWith('T7-')) {
    const { data: perfil } = await admin
      .from('profiles')
      .select('id')
      .eq('user_code', busca.toUpperCase())
      .maybeSingle()
    targetUserId = perfil?.id ?? null
  } else {
    // Busca por email — listUsers com filtro para não carregar toda a base
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const found = users.find(u => u.email?.toLowerCase() === busca.toLowerCase())
    targetUserId = found?.id ?? null
  }

  if (!targetUserId) {
    return NextResponse.json(
      { error: 'Usuário não encontrado. Verifique o email ou código T7-USR.' },
      { status: 404 }
    )
  }

  const targetUser = { id: targetUserId }

  // Não pode adicionar a si mesmo
  if (targetUser.id === user.id) {
    return NextResponse.json(
      { error: 'Você já é o organizador deste evento.' },
      { status: 400 }
    )
  }

  // Valida que a função pertence a este evento
  const { data: funcao } = await admin
    .from('event_positions')
    .select('id')
    .eq('id', body.funcaoId)
    .eq('event_id', id)
    .single()

  if (!funcao) {
    return NextResponse.json({ error: 'Função não encontrada neste evento' }, { status: 404 })
  }

  // Se um portão foi informado, confirma que ele pertence a um estacionamento deste evento
  let portaoId: string | null = null
  if (body.portaoId) {
    const { data: portao } = await admin
      .from('estacionamento_portoes')
      .select('id, estacionamentos!inner(event_id)')
      .eq('id', body.portaoId)
      .eq('estacionamentos.event_id', id)
      .maybeSingle()
    if (!portao) return NextResponse.json({ error: 'Portão não encontrado neste evento' }, { status: 404 })
    portaoId = body.portaoId
  }

  // Cria o vínculo do membro com o evento — fica pendente até o convidado aceitar
  const { error: staffErr } = await admin
    .from('event_staff')
    .upsert({
      event_id:          id,
      user_id:           targetUser.id,
      event_position_id: funcao.id,
      portao_id:         portaoId,
      status:            'pending',
      invited_by:        user.id,
    }, { onConflict: 'event_id,user_id' })

  if (staffErr) {
    return NextResponse.json({ error: staffErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// PATCH /api/eventos/[id]/equipe — troca a função de um membro
// body: { staffId, funcaoId }
export async function PATCH(
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

  const { staffId, funcaoId, portaoId } = await req.json() as {
    staffId:   string
    funcaoId:  string
    portaoId?: string | null   // undefined = não mexe; null = remove restrição; string = define
  }

  if (!staffId || !funcaoId) {
    return NextResponse.json({ error: 'staffId e funcaoId são obrigatórios' }, { status: 400 })
  }

  // Garante que a função pertence a este evento
  const { data: funcao } = await admin
    .from('event_positions')
    .select('id')
    .eq('id', funcaoId)
    .eq('event_id', id)
    .single()

  if (!funcao) {
    return NextResponse.json({ error: 'Função não encontrada neste evento' }, { status: 404 })
  }

  const updates: Record<string, unknown> = { event_position_id: funcaoId }

  if (portaoId !== undefined) {
    if (portaoId === null) {
      updates.portao_id = null
    } else {
      const { data: portao } = await admin
        .from('estacionamento_portoes')
        .select('id, estacionamentos!inner(event_id)')
        .eq('id', portaoId)
        .eq('estacionamentos.event_id', id)
        .maybeSingle()
      if (!portao) return NextResponse.json({ error: 'Portão não encontrado neste evento' }, { status: 404 })
      updates.portao_id = portaoId
    }
  }

  const { error } = await admin
    .from('event_staff')
    .update(updates)
    .eq('id', staffId)
    .eq('event_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
