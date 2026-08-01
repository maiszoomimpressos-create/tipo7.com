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

// GET /api/admin/banners-sistema — lista todos (ativos e inativos) pro painel
export async function GET() {
  const me = await requireMarketingAdmin()
  if (!me) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createServiceClient()
  const { data, error } = await admin
    .from('system_banners')
    .select('id, image_url, active, order_index, created_at')
    .order('order_index')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ banners: data ?? [] })
}

// POST /api/admin/banners-sistema — sobe a imagem (multipart/form-data, campo "file") e cria o registro
export async function POST(request: NextRequest) {
  const me = await requireMarketingAdmin()
  if (!me) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Imagem maior que 10 MB' }, { status: 400 })
  }

  const admin = createServiceClient()
  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `_system-banners/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await admin.storage
    .from('event-images')
    .upload(path, file, { contentType: file.type })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: publicUrlData } = admin.storage.from('event-images').getPublicUrl(path)

  const { data, error } = await admin
    .from('system_banners')
    .insert({ image_url: publicUrlData.publicUrl })
    .select('id, image_url, active, order_index, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ banner: data })
}
