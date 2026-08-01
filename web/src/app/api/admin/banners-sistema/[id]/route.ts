import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember, can } from '@/lib/adminAuth'

async function requireMarketingAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const me = await getAdminMember(user.id)
  if (!me || !can(me, 'gerenciar_eventos')) return null
  return me
}

interface Props {
  params: Promise<{ id: string }>
}

// PATCH /api/admin/banners-sistema/[id] — ativa/desativa
export async function PATCH(request: NextRequest, { params }: Props) {
  const me = await requireMarketingAdmin()
  if (!me) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  if (typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'Campo "active" obrigatório' }, { status: 400 })
  }

  const admin = createServiceClient()
  const { error } = await admin
    .from('system_banners')
    .update({ active: body.active })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/banners-sistema/[id] — remove o banner
export async function DELETE(_request: NextRequest, { params }: Props) {
  const me = await requireMarketingAdmin()
  if (!me) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const admin = createServiceClient()
  const { error } = await admin.from('system_banners').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
