import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember, can } from '@/lib/adminAuth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const member = await getAdminMember(user.id)
  if (!member || !can(member, 'gerenciar_promotores')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { userId } = await params
  const { fee_pct } = await req.json() as { fee_pct: number }

  if (typeof fee_pct !== 'number' || fee_pct < 0 || fee_pct > 100) {
    return NextResponse.json({ error: 'fee_pct deve ser um número entre 0 e 100' }, { status: 400 })
  }

  const admin = createServiceClient()
  await admin
    .from('promotor_mp_accounts')
    .update({ fee_pct, updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  return NextResponse.json({ ok: true })
}
