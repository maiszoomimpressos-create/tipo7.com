import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const REDIRECT_URI  = 'https://tipo7.com/api/mp/callback'
const BASE          = 'https://tipo7.com'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const erro  = searchParams.get('error')

  // Usuário cancelou na tela do MP
  if (erro) {
    return NextResponse.redirect(`${BASE}/configuracoes/contas?mp_erro=cancelado`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${BASE}/configuracoes/contas?mp_erro=parametros`)
  }

  // Valida state anti-CSRF
  const jar = await cookies()
  const stateGuardado = jar.get('mp_oauth_state')?.value
  jar.delete('mp_oauth_state')

  if (!stateGuardado || stateGuardado !== state) {
    return NextResponse.redirect(`${BASE}/configuracoes/contas?mp_erro=state`)
  }

  // Troca o code pelo access_token
  const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  REDIRECT_URI,
    }),
  })

  if (!tokenRes.ok) {
    console.error('MP token error:', await tokenRes.text())
    return NextResponse.redirect(`${BASE}/configuracoes/contas?mp_erro=token`)
  }

  const token = await tokenRes.json() as {
    access_token:  string
    refresh_token: string
    user_id:       number
    public_key:    string
    expires_in:    number
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${BASE}/auth`)

  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString()

  const { error: dbErr } = await supabase
    .from('promotor_mp_accounts')
    .upsert(
      {
        user_id:          user.id,
        mp_user_id:       token.user_id,
        mp_access_token:  token.access_token,
        mp_refresh_token: token.refresh_token,
        mp_public_key:    token.public_key,
        expires_at:       expiresAt,
        updated_at:       new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (dbErr) {
    console.error('DB upsert error:', dbErr)
    return NextResponse.redirect(`${BASE}/configuracoes/contas?mp_erro=banco`)
  }

  return NextResponse.redirect(`${BASE}/configuracoes/contas?mp_ok=1`)
}
