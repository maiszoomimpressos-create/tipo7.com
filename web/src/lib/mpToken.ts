// Gerenciamento de tokens OAuth do Mercado Pago para promotores.
// Tokens expiram em ~6 meses — esta função renova automaticamente
// quando faltam menos de 7 dias para o vencimento.
import type { SupabaseClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tipo7.com'
const RENOVAR_ANTES_DE_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias em ms

interface MpAccount {
  mp_access_token:  string
  mp_refresh_token: string | null
  expires_at:       string | null
}

// Renova o token via refresh_token e persiste no banco.
// Lança erro se o refresh falhar — o caller deve tratar.
async function renovarToken(
  userId:  string,
  account: MpAccount,
  admin:   SupabaseClient,
): Promise<string> {
  if (!account.mp_refresh_token) {
    throw new Error('Sem refresh_token — promotor precisa reconectar a conta MP')
  }

  const res = await fetch('https://api.mercadopago.com/oauth/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      grant_type:    'refresh_token',
      refresh_token: account.mp_refresh_token,
      redirect_uri:  `${APP_URL}/api/mp/callback`,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message ?? data.error ?? 'Falha ao renovar token MP')
  }

  const newExpiresAt = data.expires_in
    ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString()
    : null

  await admin.from('promotor_mp_accounts').update({
    mp_access_token:  data.access_token,
    mp_refresh_token: data.refresh_token ?? account.mp_refresh_token,
    mp_public_key:    data.public_key    ?? null,
    expires_at:       newExpiresAt,
    updated_at:       new Date().toISOString(),
  }).eq('user_id', userId)

  console.log(`[mpToken] token renovado para promotor ${userId}, expira em ${newExpiresAt}`)
  return data.access_token as string
}

// Retorna o access token do promotor, renovando automaticamente se necessário.
// Retorna null se o promotor não tiver conta MP conectada.
export async function getMpToken(
  userId: string,
  admin:  SupabaseClient,
): Promise<string | null> {
  const { data: account } = await admin
    .from('promotor_mp_accounts')
    .select('mp_access_token, mp_refresh_token, expires_at')
    .eq('user_id', userId)
    .single()

  if (!account) return null

  // Token prestes a expirar ou já expirado → renova proativamente
  const precisaRenovar =
    account.expires_at &&
    new Date(account.expires_at).getTime() - Date.now() < RENOVAR_ANTES_DE_MS

  if (precisaRenovar) {
    try {
      return await renovarToken(userId, account, admin)
    } catch (err) {
      // Se o refresh falhar, tenta usar o token atual (pode ainda funcionar)
      console.error('[mpToken] falha ao renovar, usando token existente:', err)
    }
  }

  return account.mp_access_token
}
