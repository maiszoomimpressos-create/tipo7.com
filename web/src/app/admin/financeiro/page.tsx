import { createServiceClient } from '@/lib/supabase/server'
import { FinanceiroClient } from './FinanceiroClient'
import { RulesClient } from './RulesClient'

export default async function FinanceiroPage() {
  const admin = createServiceClient()

  const [
    { data: settings },
    { data: mpAccounts },
    { data: eventos },
    { data: promotoresPerfis },
    { data: rules },
  ] = await Promise.all([
    admin.from('platform_settings').select('key, value'),
    admin.from('promotor_mp_accounts').select('user_id, fee_pct'),
    admin.from('events').select('id, title').eq('status', 'publicado').order('created_at', { ascending: false }),
    admin.from('profiles').select('id, full_name'),
    admin.from('fee_rules').select('*').order('created_at', { ascending: false }),
  ])

  const settingsMap: Record<string, string> = {}
  for (const s of settings ?? []) settingsMap[s.key] = s.value

  const feePcts = (mpAccounts ?? []).map(a => Number(a.fee_pct))
  const mediaFee = feePcts.length > 0
    ? feePcts.reduce((s, f) => s + f, 0) / feePcts.length
    : Number(settingsMap['default_fee_pct'] ?? 10)

  // Enriquece regras com nomes
  const enrichedRules = await Promise.all((rules ?? []).map(async rule => {
    let event_title:   string | null = null
    let promoter_name: string | null = null

    if (rule.event_id) {
      const ev = (eventos ?? []).find(e => e.id === rule.event_id)
      event_title = ev?.title ?? null
    }
    if (rule.user_id) {
      const pf = (promotoresPerfis ?? []).find(p => p.id === rule.user_id)
      promoter_name = pf?.full_name ?? null
    }
    return { ...rule, event_title, promoter_name, quota_used: 0 }
  }))

  const promotoresLista = (promotoresPerfis ?? [])
    .filter(p => p.full_name)
    .map(p => ({ id: p.id, nome: p.full_name! }))

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Financeiro
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Tarifas e políticas da plataforma
        </p>
      </div>

      <FinanceiroClient
        defaultFeePct={Number(settingsMap['default_fee_pct'] ?? 10)}
        minFeePct={Number(settingsMap['min_fee_pct'] ?? 0)}
        totalConectados={mpAccounts?.length ?? 0}
        mediaFee={mediaFee}
      />

      <RulesClient
        initialRules={enrichedRules as Parameters<typeof RulesClient>[0]['initialRules']}
        eventos={eventos ?? []}
        promotores={promotoresLista}
      />
    </div>
  )
}
