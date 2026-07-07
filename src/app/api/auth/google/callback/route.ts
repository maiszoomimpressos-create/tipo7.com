// GET /api/auth/google/callback
// Recebe o código do Google, troca por tokens e cria sessão no Supabase
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const storedState = req.cookies.get('google_oauth_state')?.value
  const next        = req.cookies.get('google_oauth_next')?.value ?? '/'

  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/auth?erro=${msg}`, req.url))

  if (error || !code)               return fail('google_cancelled')
  if (!storedState || storedState !== state) return fail('csrf')

  // Troca o código por tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      redirect_uri:  `${req.nextUrl.origin}/api/auth/google/callback`,
      grant_type:    'authorization_code',
    }),
  })

  if (!tokenRes.ok) return fail('google_token')

  const { id_token } = await tokenRes.json() as { id_token?: string }
  if (!id_token)     return fail('no_id_token')

  // Cria sessão no Supabase com o ID token do Google
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token:    id_token,
  })

  if (signInError) return fail('supabase')

  const response = NextResponse.redirect(new URL(next, req.url))
  response.cookies.delete('google_oauth_state')
  response.cookies.delete('google_oauth_next')
  return response
}
