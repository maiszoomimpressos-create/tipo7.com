import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { Header }         from '@/components/layout/Header'
import { PromoterLayout } from '@/components/layout/PromoterLayout'
import { ContasClient }   from './ContasClient'

const FEE_KEYS = [
  'default_fee_pct',
  'fee_desc_plataforma',
  'fee_pct_pix',
  'fee_pct_debito',
  'fee_pct_credito_1x',
  'fee_pct_credito_6x',
  'fee_pct_credito_12x',
  'fee_nota_extra',
]

export default async function ContasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/configuracoes/contas')

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)

  if (!orgs || orgs.length === 0) redirect('/criar-evento')

  const admin = createServiceClient()

  const [{ data: contaMP }, { data: settingsRows }] = await Promise.all([
    supabase
      .from('promotor_mp_accounts')
      .select('mp_user_id, mp_access_token, mp_public_key, updated_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    admin
      .from('platform_settings')
      .select('key, value')
      .in('key', FEE_KEYS),
  ])

  const s: Record<string, string> = {}
  for (const row of settingsRows ?? []) s[row.key] = row.value

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

          <ContasClient contaAtual={contaMP ?? null} tarifas={tarifas} />

        </main>
      </PromoterLayout>
    </div>
  )
}
