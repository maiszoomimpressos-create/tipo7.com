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

  const body = await req.json() as { default_fee_pct?: number; min_fee_pct?: number }

  for (const [key, val] of Object.entries(body)) {
    if (val !== undefined && (typeof val !== 'number' || val < 0 || val > 100)) {
      return NextResponse.json({ error: `${key} deve ser um número entre 0 e 100` }, { status: 400 })
    }
  }

  const admin = createServiceClient()

  if (body.default_fee_pct !== undefined) {
    await admin.from('platform_settings')
      .upsert({ key: 'default_fee_pct', value: String(body.default_fee_pct), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  }
  if (body.min_fee_pct !== undefined) {
    await admin.from('platform_settings')
      .upsert({ key: 'min_fee_pct', value: String(body.min_fee_pct), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  }

  return NextResponse.json({ ok: true })
}
