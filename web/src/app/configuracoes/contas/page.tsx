import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect }       from 'next/navigation'
import { Header }         from '@/components/layout/Header'
import { PromoterLayout } from '@/components/layout/PromoterLayout'
import { ContasClient }   from './ContasClient'

export default async function ContasPage() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/configuracoes/contas')

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)

  if (!orgs || orgs.length === 0) redirect('/criar-evento')

  const [{ data: contaMP }, { data: contaPagBank }, settingsRes] = await Promise.all([
    supabase
      .from('promotor_mp_accounts')
      .select('mp_user_id, mp_access_token, mp_public_key, updated_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('promotor_pagbank_accounts')
      .select('pagbank_account_id, updated_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    apiFetchServer('/api/platform-settings/public'),
  ])

  const s: Record<string, string> = settingsRes.ok ? await settingsRes.json() : {}

  const tarifas = {
    platformFeePct: s['default_fee_pct']       ?? '10',
    descPlataforma: s['fee_desc_plataforma']   ?? '',
    pctPix:         s['fee_pct_pix']           ?? '0,99',
    pctDebito:      s['fee_pct_debito']        ?? '1,49',
    pctCredito1x:   s['fee_pct_credito_1x']   ?? '4,98',
    pctCredito6x:   s['fee_pct_credito_6x']   ?? '5,98',
    pctCredito12x:  s['fee_pct_credito_12x']  ?? '6,98',
    notaExtra:      s['fee_nota_extra']         ?? '',
  }

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col">
      <Header />
      <PromoterLayout>
        <main className="max-w-2xl mx-auto px-4 py-12 w-full">

          <div className="mb-8">
            <h1
              className="text-2xl text-white mb-1"
              style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}
            >
              Contas de pagamento
            </h1>
            <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Conecte sua conta para receber os pagamentos dos seus eventos.
            </p>
          </div>

          <ContasClient contaAtual={contaMP ?? null} contaPagBankAtual={contaPagBank ?? null} tarifas={tarifas} />

        </main>
      </PromoterLayout>
    </div>
  )
}
