import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tipo7.com'

// Rotas internas permitidas no returnTo (evita open redirect)
function isSafeReturnTo(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code      = searchParams.get('code')
  const rawState  = decodeURIComponent(searchParams.get('state') ?? '')
  const [userId, returnTo] = rawState.includes('::') ? rawState.split('::') : [rawState, '']

  if (!code || !userId) {
    return NextResponse.redirect(`${APP_URL}/criar-evento?mp_error=callback_invalido`)
  }

  // Verifica que o userId do state bate com o usuário autenticado — bloqueia CSRF
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== userId) {
    return NextResponse.redirect(`${APP_URL}/criar-evento?mp_error=sessao_invalida`)
  }

  const safeReturn = returnTo && isSafeReturnTo(returnTo) ? returnTo : '/criar-evento'
  const successUrl = `${APP_URL}${safeReturn}?mp_connected=1`

  try {
    const res = await fetch('https://api.mercadopago.com/oauth/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     process.env.MP_CLIENT_ID,
        client_secret: process.env.MP_CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  `${APP_URL}/api/mp/callback`,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message ?? data.error ?? 'Erro na autenticação com Mercado Pago')

    const admin = createServiceClient()
    await admin.from('promotor_mp_accounts').upsert({
      user_id:          userId,
      mp_user_id:       data.user_id,
      mp_access_token:  data.access_token,
      mp_refresh_token: data.refresh_token ?? null,
      mp_public_key:    data.public_key    ?? null,
      expires_at:       data.expires_in
        ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return NextResponse.redirect(successUrl)

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[mp/callback]', msg)
    return NextResponse.redirect(`${APP_URL}/criar-evento?mp_error=${encodeURIComponent(msg)}`)
  }
}
