import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface Params { params: Promise<{ slideId: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const { slideId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createServiceClient()

  const { data: slide } = await admin
    .from('carrossel_slides')
    .select('id, storage_path, organization_id')
    .eq('id', slideId)
    .single()

  if (!slide) return NextResponse.json({ error: 'Slide não encontrado' }, { status: 404 })

  // Verifica posse
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', slide.organization_id)
    .eq('owner_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  await admin.storage.from('carrossel').remove([slide.storage_path])
  await admin.from('carrossel_slides').delete().eq('id', slideId)

  return NextResponse.json({ ok: true })
}
