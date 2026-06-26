import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tipo7.com'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const rawReturn = new URL(req.url).searchParams.get('return_to') ?? ''
  // Aceita apenas caminhos internos (evita open redirect via return_to=https://malicioso.com)
  const returnTo  = rawReturn.startsWith('/') && !rawReturn.startsWith('//') ? rawReturn : ''
  const state     = returnTo ? `${user.id}::${returnTo}` : user.id
  const clientId    = process.env.MP_CLIENT_ID!
  const redirectUri = encodeURIComponent(`${APP_URL}/api/mp/callback`)
  const url         = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${encodeURIComponent(state)}&redirect_uri=${redirectUri}`

  return NextResponse.redirect(url)
}
