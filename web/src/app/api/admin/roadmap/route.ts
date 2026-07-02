import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember } from '@/lib/adminAuth'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const member = await getAdminMember(user.id)
  if (!member) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createServiceClient()
  const { data } = await admin
    .from('platform_settings')
    .select('value')
    .eq('key', 'roadmap_items')
    .single()

  if (!data?.value) return NextResponse.json({ items: null })

  try {
    return NextResponse.json({ items: JSON.parse(data.value) })
  } catch {
    return NextResponse.json({ items: null })
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const member = await getAdminMember(user.id)
  if (!member) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as { items: unknown }
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: 'Formato inválido' }, { status: 400 })
  }

  const admin = createServiceClient()
  await admin.from('platform_settings').upsert(
    { key: 'roadmap_items', value: JSON.stringify(body.items), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )

  return NextResponse.json({ ok: true })
}
