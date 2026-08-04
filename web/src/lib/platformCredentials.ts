// Credenciais da própria conta Tipo7 nos gateways de pagamento (não confundir
// com as contas OAuth dos promotores em promotor_mp_accounts/promotor_pagbank_accounts).
// Fonte de verdade agora é platform_settings (editável em Admin > Financeiro >
// Bancos > aba Gateways) — variável de ambiente vira só o fallback pra não
// quebrar nada enquanto a tela não for preenchida.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface MpPlatformCredentials {
  accessToken:   string
  publicKey:     string | null
  clientId:      string | null
  clientSecret:  string | null
  webhookSecret: string | null
}

const MP_CRED_KEYS = [
  'mp_access_token', 'mp_public_key', 'mp_client_id', 'mp_client_secret', 'mp_webhook_secret',
] as const

export async function getMpPlatformCredentials(admin: SupabaseClient): Promise<MpPlatformCredentials> {
  const { data } = await admin.from('platform_settings').select('key, value').in('key', MP_CRED_KEYS)
  const s: Record<string, string> = {}
  for (const row of data ?? []) if (row.value) s[row.key] = row.value

  return {
    accessToken:   s['mp_access_token']   || process.env.MP_ACCESS_TOKEN!,
    publicKey:     s['mp_public_key']     || process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || null,
    clientId:      s['mp_client_id']      || process.env.MP_CLIENT_ID              || null,
    clientSecret:  s['mp_client_secret']  || process.env.MP_CLIENT_SECRET          || null,
    webhookSecret: s['mp_webhook_secret'] || process.env.MP_WEBHOOK_SECRET         || null,
  }
}

export interface PagBankPlatformCredentials {
  token:        string | null
  accountId:    string | null
  clientId:     string | null
  clientSecret: string | null
}

// Sem campo de webhook secret — o portal do PagBank não tem nenhum lugar
// pra configurar um segredo compartilhado de notificação (conferido em
// "Configurações de integração" e "Gestão de preferências"). Ver comentário
// em src/app/api/webhooks/pagbank/route.ts sobre a mitigação usada no lugar.
const PAGBANK_CRED_KEYS = [
  'pagbank_token', 'pagbank_account_id', 'pagbank_client_id', 'pagbank_client_secret',
] as const

export async function getPagBankPlatformCredentials(admin: SupabaseClient): Promise<PagBankPlatformCredentials> {
  const { data } = await admin.from('platform_settings').select('key, value').in('key', PAGBANK_CRED_KEYS)
  const s: Record<string, string> = {}
  for (const row of data ?? []) if (row.value) s[row.key] = row.value

  return {
    token:        s['pagbank_token']         || process.env.PAGBANK_TOKEN         || null,
    accountId:    s['pagbank_account_id']    || process.env.PAGBANK_ACCOUNT_ID    || null,
    clientId:     s['pagbank_client_id']     || process.env.PAGBANK_CLIENT_ID     || null,
    clientSecret: s['pagbank_client_secret'] || process.env.PAGBANK_CLIENT_SECRET || null,
  }
}

export { MP_CRED_KEYS, PAGBANK_CRED_KEYS }
