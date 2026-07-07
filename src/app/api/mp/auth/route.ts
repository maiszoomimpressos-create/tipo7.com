import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

const REDIRECT_URI = 'https://tipo7.com/api/mp/callback'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/auth', 'https://www.tipo7.com'))

  // State aleatório para prevenir CSRF
  const state = randomBytes(16).toString('hex')

  const jar = await cookies()
  jar.set('mp_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutos
    path: '/',
  })

  const url = new URL('https://auth.mercadopago.com.br/authorization')
  url.searchParams.set('client_id',     process.env.MP_CLIENT_ID!)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('platform_id',   'mp')
  url.searchParams.set('redirect_uri',  REDIRECT_URI)
  url.searchParams.set('state',         state)

  return NextResponse.redirect(url.toString())
}
