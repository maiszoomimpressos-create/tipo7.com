import { getAuthUser } from '@/lib/auth/server'
import { getAdminMember, temAcessoRestrito } from '@/lib/adminAuth'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect } from 'next/navigation'
import { FinanceiroClient } from './FinanceiroClient'
import { RulesClient } from './RulesClient'
import { AreaRestritaWatcher } from '@/app/admin/area-restrita/AreaRestritaWatcher'

export default async function IngressosOnlinePage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/admin/financeiro/ingressos-online')

  const member = await getAdminMember(user.id)
  if (!member || !temAcessoRestrito(member)) redirect('/admin')

  const statusRes = await apiFetchServer('/api/admin/area-restrita/status')
  const { desbloqueada } = statusRes.ok ? await statusRes.json() as { desbloqueada: boolean } : { desbloqueada: false }
  if (!desbloqueada) redirect(`/admin/area-restrita?next=${encodeURIComponent('/admin/financeiro/ingressos-online')}`)

  // GET /admin/fee-rules já devolve enriquecido (event_title/promoter_name/
  // quota_used calculado de verdade, melhor que o quota_used:0 fixo que essa
  // página montava manualmente) — GET /admin/fee-rules/opcoes cobre os 3
  // dropdowns/agregados que faltavam (Fase 7.2, G15).
  const [settingsRes, opcoesRes, rulesRes] = await Promise.all([
    apiFetchServer('/api/admin/settings'),
    apiFetchServer('/api/admin/fee-rules/opcoes'),
    apiFetchServer('/api/admin/fee-rules'),
  ])

  const { settings: settingsMap } = settingsRes.ok
    ? await settingsRes.json() as { settings: Record<string, string> }
    : { settings: {} as Record<string, string> }

  const { mp_accounts: mpAccounts, eventos, promotores: promotoresLista } = opcoesRes.ok
    ? await opcoesRes.json() as {
        mp_accounts: { user_id: string; fee_pct: number }[]
        eventos: { id: string; title: string | null }[]
        promotores: { id: string; nome: string }[]
      }
    : { mp_accounts: [] as { user_id: string; fee_pct: number }[], eventos: [] as { id: string; title: string | null }[], promotores: [] as { id: string; nome: string }[] }

  const { rules: enrichedRules } = rulesRes.ok
    ? await rulesRes.json() as { rules: unknown[] }
    : { rules: [] as unknown[] }

  const feePcts = mpAccounts.map(a => a.fee_pct)
  const mediaFee = feePcts.length > 0
    ? feePcts.reduce((s, f) => s + f, 0) / feePcts.length
    : Number(settingsMap['default_fee_pct'] ?? 10)

  return (
    <div className="p-8 max-w-2xl">
      <AreaRestritaWatcher currentPath="/admin/financeiro/ingressos-online" />
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Ingressos on-line
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Tarifas e políticas de vendas pelo site
        </p>
      </div>

      <FinanceiroClient
        defaultFeePct={Number(settingsMap['default_fee_pct'] ?? 10)}
        defaultFeeType={(settingsMap['default_fee_type'] as 'fixed' | 'percent') ?? 'percent'}
        minFeePct={Number(settingsMap['min_fee_pct'] ?? 0)}
        extraFee1={{
          label: settingsMap['extra_fee_1_label'] ?? '',
          value: settingsMap['extra_fee_1_value'] ?? '0',
          type:  (settingsMap['extra_fee_1_type'] as 'fixed' | 'percent') ?? 'percent',
        }}
        extraFee2={{
          label: settingsMap['extra_fee_2_label'] ?? '',
          value: settingsMap['extra_fee_2_value'] ?? '0',
          type:  (settingsMap['extra_fee_2_type'] as 'fixed' | 'percent') ?? 'percent',
        }}
        feePixPct={Number(settingsMap['fee_pct_pix'] ?? 0.99)}
        feeCredito1xPct={Number(settingsMap['fee_pct_credito_1x'] ?? 4.98)}
        feeCredito6xPct={Number(settingsMap['fee_pct_credito_6x'] ?? 5.98)}
        feeCredito12xPct={Number(settingsMap['fee_pct_credito_12x'] ?? 6.98)}
        totalConectados={mpAccounts?.length ?? 0}
        mediaFee={mediaFee}
      />

      <RulesClient
        initialRules={enrichedRules as Parameters<typeof RulesClient>[0]['initialRules']}
        eventos={(eventos ?? []).map(e => ({ id: e.id, title: e.title ?? 'Sem título' }))}
        promotores={promotoresLista}
      />
    </div>
  )
}
