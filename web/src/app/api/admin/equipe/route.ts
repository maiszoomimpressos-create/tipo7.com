import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember } from '@/lib/adminAuth'

async function assertSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const member = await getAdminMember(user.id)
  if (!member || member.role !== 'super_admin') return null
  return user
}

export async function POST(req: NextRequest) {
  const user = await assertSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { email, role, permissions } = await req.json() as {
    email:       string
    role:        string
    permissions: string[]
  }

  const admin = createServiceClient()

  // Busca o usuário pelo email
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const target = users.find(u => u.email === email)
  if (!target) return NextResponse.json({ error: 'Usuário não encontrado. Ele precisa ter uma conta na Tipo7.' }, { status: 404 })

  // Garante que existe um perfil
  const { data: profile } = await admin.from('profiles').select('full_name').eq('id', target.id).single()

  const { data, error } = await admin.from('platform_team').insert({
    user_id:     target.id,
    role,
    permissions: role === 'admin' ? ['ver_dashboard','gerenciar_promotores','gerenciar_eventos','gerenciar_financeiro'] : permissions,
    added_by:    user.id,
  }).select('id, user_id, role, permissions, created_at').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    member: {
      id:          data.id,
      userId:      data.user_id,
      nome:        profile?.full_name ?? 'Sem nome',
      role:        data.role,
      permissions: data.permissions,
      createdAt:   data.created_at,
      isMe:        false,
    }
  })
}

export async function DELETE(req: NextRequest) {
  const user = await assertSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const memberId = new URL(req.url).searchParams.get('memberId')
  if (!memberId) return NextResponse.json({ error: 'memberId obrigatório' }, { status: 400 })

  const admin = createServiceClient()

  // Não permite remover outro super_admin
  const { data: target } = await admin.from('platform_team').select('role, user_id').eq('id', memberId).single()
  if (target?.role === 'super_admin') return NextResponse.json({ error: 'Não é possível remover um Super Admin.' }, { status: 403 })

  await admin.from('platform_team').delete().eq('id', memberId)
  return NextResponse.json({ ok: true })
}
