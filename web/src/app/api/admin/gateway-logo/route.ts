// POST /api/admin/gateway-logo
// Sobe a logo exibida no seletor de gateway em Admin > Financeiro > Bancos
// (multipart/form-data, campos "file" e "gateway") e salva a URL pública em
// platform_settings — mesmo padrão de armazenamento das credenciais.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember, temAcessoRestrito } from '@/lib/adminAuth'

const GATEWAYS = new Set(['mercadopago', 'pagbank'])

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const member = await getAdminMember(user.id)
  if (!member || !temAcessoRestrito(member)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const formData = await request.formData()
  const file    = formData.get('file')
  const gateway = formData.get('gateway')

  if (typeof gateway !== 'string' || !GATEWAYS.has(gateway)) {
    return NextResponse.json({ error: 'Gateway inválido' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Imagem maior que 5 MB' }, { status: 400 })
  }

  const admin = createServiceClient()
  const ext  = file.name.split('.').pop() ?? 'png'
  // Mesmo caminho sempre — upsert substitui a logo anterior sem acumular lixo no bucket
  const path = `_gateway-logos/${gateway}.${ext}`

  const { error: uploadError } = await admin.storage
    .from('event-images')
    .upload(path, file, { contentType: file.type, upsert: true })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: publicUrlData } = admin.storage.from('event-images').getPublicUrl(path)
  // Cache-bust: mesma URL de sempre, sem isso o browser mostra a logo antiga em cache
  const url = `${publicUrlData.publicUrl}?v=${Date.now()}`

  const { error } = await admin
    .from('platform_settings')
    .upsert({ key: `gateway_logo_${gateway}`, value: url, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ url })
}
