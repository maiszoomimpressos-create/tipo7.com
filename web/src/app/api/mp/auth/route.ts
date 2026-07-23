import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

const REDIRECT_URI = 'https://tipo7.com/api/mp/callback'

// GET /api/mp/auth?return_to=/caminho-interno
// Ponto único de entrada do OAuth do Mercado Pago — usado tanto pela tela de
// configurações (sem return_to, volta pro painel de contas) quanto pelo
// checklist de publicação de evento (com return_to, volta pra tela de origem).
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/auth', 'https://www.tipo7.com'))

  const rawReturn = new URL(req.url).searchParams.get('return_to') ?? ''
  // Aceita apenas caminhos internos (evita open redirect via //evil.com ou /\evil.com)
  const isInternal = rawReturn.startsWith('/') && !rawReturn.startsWith('//') && !rawReturn.startsWith('/\\')
  const returnTo   = isInternal ? rawReturn : ''

  // State aleatório para prevenir CSRF — o return_to viaja junto no próprio
  // parâmetro state (não é sensível) pra o callback saber pra onde voltar.
  const csrfState = randomBytes(16).toString('hex')
  const state      = returnTo ? `${csrfState}::${returnTo}` : csrfState

  const jar = await cookies()
  jar.set('mp_oauth_state', csrfState, {
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
