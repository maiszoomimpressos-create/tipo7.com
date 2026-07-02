import { createServiceClient } from '@/lib/supabase/server'
import { FinanceiroClient } from './FinanceiroClient'
import { RulesClient } from './RulesClient'

export default async function FinanceiroPage() {
  const admin = createServiceClient()

  const [
    { data: settings },
    { data: mpAccounts },
    { data: eventos },
    { data: orgsPromotoras },
    { data: rules },
  ] = await Promise.all([
    admin.from('platform_settings').select('key, value'),
    admin.from('promotor_mp_accounts').select('user_id, fee_pct'),
    admin.from('events').select('id, title').eq('status', 'publicado').order('created_at', { ascending: false }),
    admin.from('organizations').select('owner_id, profiles!owner_id(full_name)').eq('type', 'promotora'),
    admin.from('fee_rules').select('*').order('created_at', { ascending: false }),
  ])

  const settingsMap: Record<string, string> = {}
  for (const s of settings ?? []) settingsMap[s.key] = s.value

  const feePcts = (mpAccounts ?? []).map(a => Number(a.fee_pct))
  const mediaFee = feePcts.length > 0
    ? feePcts.reduce((s, f) => s + f, 0) / feePcts.length
    : Number(settingsMap['default_fee_pct'] ?? 10)

  // Mapa owner_id → nome para enriquecer regras
  const profileMap: Record<string, string> = {}
  for (const org of orgsPromotoras ?? []) {
    if (!org.owner_id) continue
    const p = Array.isArray(org.profiles) ? org.profiles[0] : org.profiles
    const nome = (p as { full_name: string | null } | null)?.full_name
    if (nome) profileMap[org.owner_id] = nome
  }

  // Enriquece regras com nomes
  const enrichedRules = (rules ?? []).map(rule => ({
    ...rule,
    event_title:   rule.event_id ? (eventos ?? []).find(e => e.id === rule.event_id)?.title ?? null : null,
    promoter_name: rule.user_id  ? (profileMap[rule.user_id] ?? null) : null,
    quota_used: 0,
  }))

  // Lista de promotores únicos para o dropdown (deduplica por owner_id)
  const seen = new Set<string>()
  const promotoresLista = (orgsPromotoras ?? []).flatMap(org => {
    if (!org.owner_id || seen.has(org.owner_id)) return []
    seen.add(org.owner_id)
    const p = Array.isArray(org.profiles) ? org.profiles[0] : org.profiles
    const nome = (p as { full_name: string | null } | null)?.full_name
    if (!nome) return []
    return [{ id: org.owner_id, nome }]
  })

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
