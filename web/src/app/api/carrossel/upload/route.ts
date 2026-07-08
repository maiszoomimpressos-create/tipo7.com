import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const form  = await req.formData()
  const file  = form.get('file')   as File | null
  const orgId = form.get('org_id') as string | null

  if (!file || !orgId) return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })

  // Verifica que o usuário é dono da organização
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .eq('owner_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createServiceClient()
  const ext   = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const path  = `${orgId}/${crypto.randomUUID()}.${ext}`

  const { error: storageErr } = await admin.storage
    .from('carrossel')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (storageErr) return NextResponse.json({ error: storageErr.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('carrossel').getPublicUrl(path)

  const { data: slide, error: dbErr } = await admin
    .from('carrossel_slides')
    .insert({ organization_id: orgId, image_url: publicUrl, storage_path: path })
    .select()
    .single()

  if (dbErr) {
    await admin.storage.from('carrossel').remove([path])
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json(slide)
}
