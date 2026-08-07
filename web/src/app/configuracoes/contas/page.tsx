import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect }       from 'next/navigation'
import { Header }         from '@/components/layout/Header'
import { PromoterLayout } from '@/components/layout/PromoterLayout'
import { ContasClient }   from './ContasClient'

export default async function ContasPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/configuracoes/contas')

  // GET /organizations já devolve as organizações que o usuário administra
  // (dono ou sócio ativo) — mesma checagem "tem organização?" que a query
  // direta fazia (Fase 7.2, resíduo do G14).
  const orgsRes = await apiFetchServer('/api/organizations')
  const { organizacoes } = orgsRes.ok
    ? await orgsRes.json() as { organizacoes: Array<{ status: string }> }
    : { organizacoes: [] as Array<{ status: string }> }

  if (!organizacoes.some(o => o.status === 'ativo')) redirect('/criar-evento')

  // Nunca buscar mp_access_token/mp_public_key aqui — GET /mp/status e
  // GET /pagbank/status já nunca devolvem o token bruto, de propósito
  // (achado de segurança real na Fase 7.2, G14: o objeto cru do Supabase
  // ia direto pro Client Component, vazando o token de acesso da conta
  // Mercado Pago do promotor no payload RSC que chega no navegador).
  const [mpRes, pagbankRes, settingsRes] = await Promise.all([
    apiFetchServer('/api/mp/status'),
    apiFetchServer('/api/pagbank/status'),
    apiFetchServer('/api/platform-settings/public'),
  ])

  const contaMP        = mpRes.ok      ? await mpRes.json()      : { connected: false }
  const contaPagBank   = pagbankRes.ok ? await pagbankRes.json() : { connected: false }
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

          <ContasClient contaAtual={contaMP} contaPagBankAtual={contaPagBank} tarifas={tarifas} />

        </main>
      </PromoterLayout>
    </div>
  )
}
