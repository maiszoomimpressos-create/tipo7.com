import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/organizations/[id]/socios/responder — o próprio convidado
// aceita ou recusa administrar essa organização (nunca quem convidou).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as { aceitar?: boolean }

  const admin = createServiceClient()
  const { data: convite } = await admin
    .from('organization_admins')
    .select('id')
    .eq('organization_id', id)
    .eq('user_id', user.id)
    .eq('status', 'convidado')
    .maybeSingle()

  if (!convite) return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 })

  if (body.aceitar) {
    await admin.from('organization_admins').update({ status: 'ativo' }).eq('id', convite.id)
  } else {
    await admin.from('organization_admins').update({ status: 'removido' }).eq('id', convite.id)
  }

  return NextResponse.json({ ok: true })
}
