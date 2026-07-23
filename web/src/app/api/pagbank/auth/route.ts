import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tipo7.com'
const PAGBANK_ENV  = process.env.PAGBANK_ENV === 'sandbox' ? 'sandbox' : 'production'
const AUTH_BASE    = PAGBANK_ENV === 'sandbox'
  ? 'https://connect.sandbox.pagbank.com.br/oauth2/authorize'
  : 'https://connect.pagbank.com.br/oauth2/authorize'
const REDIRECT_URI = `${APP_URL}/api/pagbank/callback`

// GET /api/pagbank/auth?return_to=/caminho-interno
// Mesmo padrão de /api/mp/auth: state = csrfState[::returnTo], csrfState
// também vai num cookie httpOnly pra validação anti-CSRF no callback.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/auth', APP_URL))

  const rawReturn = new URL(req.url).searchParams.get('return_to') ?? ''
  const isInternal = rawReturn.startsWith('/') && !rawReturn.startsWith('//') && !rawReturn.startsWith('/\\')
  const returnTo   = isInternal ? rawReturn : ''

  const csrfState = randomBytes(16).toString('hex')
  const state      = returnTo ? `${csrfState}::${returnTo}` : csrfState

  const jar = await cookies()
  jar.set('pagbank_oauth_state', csrfState, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    maxAge:   600, // 10 minutos
    path:     '/',
  })

  const url = new URL(AUTH_BASE)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id',     process.env.PAGBANK_CLIENT_ID!)
  url.searchParams.set('redirect_uri',  REDIRECT_URI)
  url.searchParams.set('scope',         'payments.read payments.create accounts.read')
  url.searchParams.set('state',         state)

  return NextResponse.redirect(url.toString())
}
