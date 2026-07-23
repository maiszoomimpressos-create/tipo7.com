import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { pagbankAuthHeaders, extrairAccountId, PAGBANK_API_BASE, type PagBankTokenResponse } from '@/lib/pagbankToken'

const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tipo7.com'
const REDIRECT_URI = `${APP_URL}/api/pagbank/callback`

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const erro  = searchParams.get('error')

  if (erro) {
    return NextResponse.redirect(`${APP_URL}/configuracoes/contas?pagbank_erro=cancelado`)
  }
  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/configuracoes/contas?pagbank_erro=parametros`)
  }

  const [csrfState, returnTo] = state.split('::')

  const jar = await cookies()
  const stateGuardado = jar.get('pagbank_oauth_state')?.value
  jar.delete('pagbank_oauth_state')

  if (!stateGuardado || stateGuardado !== csrfState) {
    return NextResponse.redirect(`${APP_URL}/configuracoes/contas?pagbank_erro=state`)
  }

  const isInternal = !!returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.startsWith('/\\')
  const destino     = isInternal ? returnTo : '/configuracoes/contas'

  const tokenRes = await fetch(`${PAGBANK_API_BASE}/oauth2/token`, {
    method:  'POST',
    headers: pagbankAuthHeaders(),
    body: JSON.stringify({
      grant_type:   'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  })

  const token = await tokenRes.json().catch(() => null) as PagBankTokenResponse | null

  if (!tokenRes.ok || !token) {
    console.error('PagBank token error:', tokenRes.status, JSON.stringify(token))
    return NextResponse.redirect(`${APP_URL}${destino}?pagbank_erro=token`)
  }

  // Diagnóstico único: o campo que identifica a conta do vendedor não é
  // documentado publicamente — loga a resposta crua (sem os tokens) pra
  // confirmarmos o nome certo do campo assim que o primeiro promotor conectar.
  console.log('[pagbank/callback] resposta do token (diagnóstico):', JSON.stringify({
    ...token, access_token: '[omitido]', refresh_token: '[omitido]',
  }))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${APP_URL}/auth`)

  const expiresAt   = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null
  const accountId   = extrairAccountId(token) ?? 'desconhecida'

  const { error: dbErr } = await supabase
    .from('promotor_pagbank_accounts')
    .upsert(
      {
        user_id:               user.id,
        pagbank_account_id:    accountId,
        pagbank_access_token:  token.access_token,
        pagbank_refresh_token: token.refresh_token ?? null,
        expires_at:            expiresAt,
        updated_at:            new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (dbErr) {
    console.error('DB upsert error (pagbank):', dbErr)
    return NextResponse.redirect(`${APP_URL}${destino}?pagbank_erro=banco`)
  }

  const separador = destino.includes('?') ? '&' : '?'
  return NextResponse.redirect(`${APP_URL}${destino}${separador}pagbank_ok=1`)
}
