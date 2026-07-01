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

// GET /api/admin/conteudo?key=termos
// platform_content tem RLS pública para SELECT — usa anon client, não service role
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('platform_content')
    .select('content, updated_at')
    .eq('key', key)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT /api/admin/conteudo
// Body: { key: string; content: string }
export async function PUT(req: NextRequest) {
  const me = await requireSuperAdmin()
  if (!me) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { key, content } = await req.json() as { key?: string; content?: string }
  if (!key || content === undefined) {
    return NextResponse.json({ error: 'key e content são obrigatórios' }, { status: 400 })
  }

  const admin = createServiceClient()
  const { error } = await admin
    .from('platform_content')
    .upsert({ key, content, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
