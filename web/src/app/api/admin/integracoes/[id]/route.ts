import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember } from '@/lib/adminAuth'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const me = await getAdminMember(user.id)
  if (!me || me.role !== 'super_admin') return null
  return me
}

interface Params { params: Promise<{ id: string }> }

// PUT /api/admin/integracoes/[id]
// Body: { base_url?, api_key?, webhook_secret? } — credenciais reais,
// usadas de verdade por lib/autosave.ts e api/webhooks/autosave.
export async function PUT(req: NextRequest, { params }: Params) {
  const me = await requireSuperAdmin()
  if (!me) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const body = await req.json() as { base_url?: string; api_key?: string; webhook_secret?: string }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.base_url      !== undefined) updates.base_url      = body.base_url.trim()      || null
  if (body.api_key       !== undefined) updates.api_key       = body.api_key.trim()       || null
  if (body.webhook_secret !== undefined) updates.webhook_secret = body.webhook_secret.trim() || null

  const admin = createServiceClient()
  const { error } = await admin.from('api_integracoes').update(updates).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
