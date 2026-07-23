// Gerenciamento de tokens OAuth Connect do PagBank para promotores.
// Espelha src/lib/mpToken.ts. Alguns detalhes do formato de resposta do
// PagBank Connect não são públicos na documentação (nome exato do campo que
// identifica a conta do vendedor) — por isso renovarToken loga a resposta
// crua uma vez, pra confirmarmos o campo certo assim que o primeiro
// promotor conectar de verdade.
import type { SupabaseClient } from '@supabase/supabase-js'

const APP_URL     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tipo7.com'
const PAGBANK_ENV = process.env.PAGBANK_ENV === 'sandbox' ? 'sandbox' : 'production'
const API_BASE    = PAGBANK_ENV === 'sandbox'
  ? 'https://sandbox.api.pagseguro.com'
  : 'https://api.pagseguro.com'
const RENOVAR_ANTES_DE_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias em ms

interface PagBankTokenResponse {
  access_token:  string
  refresh_token?: string
  expires_in?:    number
  account_id?:    string
  seller_id?:     string
  public_id?:     string
  [key: string]: unknown
}

interface PagBankAccount {
  pagbank_access_token:  string
  pagbank_refresh_token: string | null
  expires_at:            string | null
}

function pagbankAuthHeaders(): Record<string, string> {
  return {
    'Content-Type':    'application/json',
    'Authorization':   `Bearer ${process.env.PAGBANK_TOKEN}`,
    'X_CLIENT_ID':     process.env.PAGBANK_CLIENT_ID!,
    'X_CLIENT_SECRET': process.env.PAGBANK_CLIENT_SECRET!,
  }
}

// Extrai o identificador da conta do vendedor da resposta do token —
// o nome exato do campo não é documentado publicamente, então tenta os
// candidatos mais prováveis antes de desistir.
function extrairAccountId(data: PagBankTokenResponse): string | null {
  return data.account_id ?? data.seller_id ?? data.public_id ?? null
}

async function renovarToken(
  userId:  string,
  account: PagBankAccount,
  admin:   SupabaseClient,
): Promise<string> {
  if (!account.pagbank_refresh_token) {
    throw new Error('Sem refresh_token — promotor precisa reconectar a conta PagBank')
  }

  const res = await fetch(`${API_BASE}/oauth2/refresh`, {
    method:  'POST',
    headers: pagbankAuthHeaders(),
    body: JSON.stringify({
      grant_type:    'refresh_token',
      refresh_token: account.pagbank_refresh_token,
    }),
  })

  const data = await res.json().catch(() => null) as PagBankTokenResponse | null
  if (!res.ok || !data) {
    throw new Error('Falha ao renovar token PagBank')
  }

  const newExpiresAt = data.expires_in
    ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString()
    : null

  await admin.from('promotor_pagbank_accounts').update({
    pagbank_access_token:  data.access_token,
    pagbank_refresh_token: data.refresh_token ?? account.pagbank_refresh_token,
    expires_at:            newExpiresAt,
    updated_at:            new Date().toISOString(),
  }).eq('user_id', userId)

  console.log(`[pagbankToken] token renovado para promotor ${userId}, expira em ${newExpiresAt}`)
  return data.access_token
}

// Retorna o access token do promotor, renovando automaticamente se necessário.
// Retorna null se o promotor não tiver conta PagBank conectada.
export async function getPagBankToken(
  userId: string,
  admin:  SupabaseClient,
): Promise<string | null> {
  const { data: account } = await admin
    .from('promotor_pagbank_accounts')
    .select('pagbank_access_token, pagbank_refresh_token, expires_at')
    .eq('user_id', userId)
    .single()

  if (!account) return null

  const precisaRenovar =
    account.expires_at &&
    new Date(account.expires_at).getTime() - Date.now() < RENOVAR_ANTES_DE_MS

  if (precisaRenovar) {
    try {
      return await renovarToken(userId, account, admin)
    } catch (err) {
      console.error('[pagbankToken] falha ao renovar, usando token existente:', err)
    }
  }

  return account.pagbank_access_token
}

export interface PagBankSplit {
  method:    'FIXED'
  receivers: Array<{ account: { id: string }; amount: { value: number } }>
}

// Resolve o split de pagamento pro dono do evento: {feePct}% pra conta da
// Tipo7, o restante pra conta PagBank conectada do promotor. Retorna null se
// o promotor não tiver conta PagBank conectada — quem chamar deve bloquear o
// checkout nesse caso, nunca cair de volta pra conta única da Tipo7 (senão
// volta o mesmo problema de "misturança" que fechamos no Mercado Pago).
export async function resolvePagBankSplit(
  ownerId:       string,
  admin:         SupabaseClient,
  totalCentavos: number,
): Promise<PagBankSplit | null> {
  const platformAccountId = process.env.PAGBANK_ACCOUNT_ID
  if (!platformAccountId) return null

  const { data: conta } = await admin
    .from('promotor_pagbank_accounts')
    .select('pagbank_account_id, fee_pct')
    .eq('user_id', ownerId)
    .maybeSingle()

  if (!conta?.pagbank_account_id) return null

  const feePct         = Number(conta.fee_pct ?? 10)
  const platformAmount = Math.round(totalCentavos * feePct / 100)
  const promoterAmount = totalCentavos - platformAmount // garante que a soma bate exato com o total

  return {
    method: 'FIXED',
    receivers: [
      { account: { id: conta.pagbank_account_id }, amount: { value: promoterAmount } },
      { account: { id: platformAccountId },         amount: { value: platformAmount } },
    ],
  }
}

export { API_BASE as PAGBANK_API_BASE, pagbankAuthHeaders, extrairAccountId }
export type { PagBankTokenResponse }
