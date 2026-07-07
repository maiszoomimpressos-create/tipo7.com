// GET /api/auth/google
// Inicia o fluxo OAuth do Google com redirect_uri apontando para tipo7.com
// O Google mostrará "tipo7.com" na tela de autorização, não supabase.co
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const next  = req.nextUrl.searchParams.get('next') ?? '/'
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  `${req.nextUrl.origin}/api/auth/google/callback`,
    response_type: 'code',
    scope:         'openid email profile',
    state,
    access_type:   'online',
    prompt:        'select_account',
  })

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  )

  response.cookies.set('google_oauth_state', state, { httpOnly: true, maxAge: 300, path: '/', sameSite: 'lax' })
  response.cookies.set('google_oauth_next',  next,  { httpOnly: true, maxAge: 300, path: '/', sameSite: 'lax' })

  return response
}
