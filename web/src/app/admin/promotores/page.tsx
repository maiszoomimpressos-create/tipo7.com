import { apiFetchServer } from '@/lib/apiFetchServer'
import { PromotoresClient } from './PromotoresClient'

interface RowApi {
  userId: string; nome: string; codigo: string | null; tipoPessoa: string | null
  mpConected: boolean; feePct: number; totalVendas: number
}

export default async function PromotoresPage() {
  const res = await apiFetchServer('/api/admin/promotores')
  const { rows } = res.ok ? await res.json() as { rows: RowApi[] } : { rows: [] as RowApi[] }

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
