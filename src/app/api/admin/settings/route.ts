import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember, can } from '@/lib/adminAuth'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const member = await getAdminMember(user.id)
  if (!member || !can(member, 'gerenciar_financeiro')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { default_fee_pct } = await req.json() as { default_fee_pct: number }

  const admin = createServiceClient()
  await admin
    .from('platform_settings')
    .upsert({ key: 'default_fee_pct', value: String(default_fee_pct), updated_at: new Date().toISOString() }, { onConflict: 'key' })

  return NextResponse.json({ ok: true })
}
