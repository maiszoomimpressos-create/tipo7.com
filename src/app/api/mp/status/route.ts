import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()
  const { data } = await admin
    .from('promotor_mp_accounts')
    .select('mp_user_id, fee_pct, expires_at, updated_at')
    .eq('user_id', user.id)
    .single()

  if (!data) return NextResponse.json({ connected: false })

  return NextResponse.json({
    connected:  true,
    mpUserId:   data.mp_user_id,
    feePct:     data.fee_pct,
    expiresAt:  data.expires_at,
    updatedAt:  data.updated_at,
  })
}
