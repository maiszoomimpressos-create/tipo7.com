// POST /api/pagbank/refresh
// Renova manualmente o token PagBank do promotor autenticado.
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPagBankToken } from '@/lib/pagbankToken'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()

  await admin
    .from('promotor_pagbank_accounts')
    .update({ expires_at: new Date(0).toISOString() })
    .eq('user_id', user.id)

  try {
    const token = await getPagBankToken(user.id, admin)
    if (!token) return NextResponse.json({ error: 'Conta PagBank não conectada' }, { status: 404 })

    const { data } = await admin
      .from('promotor_pagbank_accounts')
      .select('expires_at, updated_at')
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({ ok: true, expiresAt: data?.expires_at })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Falha ao renovar token' },
      { status: 500 },
    )
  }
}
