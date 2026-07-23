import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()
  const { data } = await admin
    .from('promotor_pagbank_accounts')
    .select('pagbank_account_id, fee_pct, expires_at, updated_at')
    .eq('user_id', user.id)
    .single()

  if (!data) return NextResponse.json({ connected: false })

  const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000
  const expiresIn      = data.expires_at ? new Date(data.expires_at).getTime() - Date.now() : null
  const tokenExpirando = expiresIn !== null && expiresIn < SETE_DIAS_MS

  return NextResponse.json({
    connected:       true,
    accountId:       data.pagbank_account_id,
    feePct:          data.fee_pct,
    expiresAt:       data.expires_at,
    updatedAt:       data.updated_at,
    tokenExpirando,
  })
}
