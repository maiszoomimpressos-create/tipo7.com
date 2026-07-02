import { createServiceClient } from '@/lib/supabase/server'
import { PromotoresClient } from './PromotoresClient'

export default async function PromotoresPage() {
  const admin = createServiceClient()

  // Fonte real de promotores: organizações do tipo 'promotora'
  const { data: orgs } = await admin
    .from('organizations')
    .select('owner_id, name, profiles!owner_id ( full_name )')
    .eq('type', 'promotora')
    .order('created_at')

  const ownerIds = (orgs ?? [])
    .map(o => o.owner_id)
    .filter((id): id is string => !!id)

  // Busca paralela: perfis de promotor (opcional) + contas MP + vendas
  const [perfisRes, mpRes, vendasRes] = await Promise.all([
    ownerIds.length
      ? admin.from('promotor_profiles').select('user_id, tipo_pessoa').in('user_id', ownerIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length
      ? admin.from('promotor_mp_accounts').select('user_id, mp_user_id, fee_pct').in('user_id', ownerIds)
      : Promise.resolve({ data: [] }),
    admin.from('orders').select('user_id, total').eq('status', 'approved'),
  ])

  // Mapas de lookup por user_id
  const perfilMap: Record<string, string> = {}
  for (const p of perfisRes.data ?? []) perfilMap[p.user_id] = p.tipo_pessoa

  const mpMap: Record<string, { mp_user_id: number; fee_pct: number }> = {}
  for (const m of mpRes.data ?? []) mpMap[m.user_id] = m

  const vendasPorUser: Record<string, number> = {}
  for (const v of vendasRes.data ?? []) {
    vendasPorUser[v.user_id] = (vendasPorUser[v.user_id] ?? 0) + Number(v.total)
  }

  // Deduplica por owner_id (mesmo usuário pode ter mais de uma org promotora)
  const seen = new Set<string>()
  const rows = (orgs ?? []).flatMap(org => {
    const uid = org.owner_id
    if (!uid || seen.has(uid)) return []
    seen.add(uid)

    const profile = Array.isArray(org.profiles) ? org.profiles[0] : org.profiles
    const mp = mpMap[uid] ?? null

    return [{
      userId:      uid,
      nome:        (profile as { full_name: string | null } | null)?.full_name ?? 'Sem nome',
      tipoPessoa:  perfilMap[uid] ?? null,
      mpConected:  !!mp,
      feePct:      mp?.fee_pct ?? 10,
      totalVendas: vendasPorUser[uid] ?? 0,
    }]
  })

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Promotores
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Gerencie os organizadores cadastrados e suas taxas
        </p>
      </div>
      <PromotoresClient rows={rows} />
    </div>
  )
}
