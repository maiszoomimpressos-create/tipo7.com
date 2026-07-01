import { createServiceClient } from '@/lib/supabase/server'
import { PromotoresClient } from './PromotoresClient'

export default async function PromotoresPage() {
  const admin = createServiceClient()

  const { data: promotores } = await admin
    .from('promotor_profiles')
    .select(`
      user_id,
      tipo_pessoa,
      profiles ( full_name ),
      promotor_mp_accounts ( mp_user_id, fee_pct, updated_at )
    `)
    .order('user_id')

  const { data: vendas } = await admin
    .from('orders')
    .select('user_id, total')
    .eq('status', 'approved')

  const vendasPorUser: Record<string, number> = {}
  for (const v of vendas ?? []) {
    vendasPorUser[v.user_id] = (vendasPorUser[v.user_id] ?? 0) + Number(v.total)
  }

  const rows = (promotores ?? []).map(p => {
    const profile = (Array.isArray(p.profiles) ? p.profiles[0] : p.profiles) as { full_name: string | null } | null
    const mp      = (Array.isArray(p.promotor_mp_accounts) ? p.promotor_mp_accounts[0] : p.promotor_mp_accounts) as { mp_user_id: number; fee_pct: number; updated_at: string } | null
    return {
      userId:     p.user_id,
      nome:       profile?.full_name ?? 'Sem nome',
      tipoPessoa: p.tipo_pessoa as string,
      mpConected: !!mp,
      feePct:     mp?.fee_pct ?? 10,
      totalVendas: vendasPorUser[p.user_id] ?? 0,
    }
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
