import { apiFetchServer } from '@/lib/apiFetchServer'
import { EstabelecimentosClient } from './EstabelecimentosClient'

interface RowApi {
  id: string; nome: string; razaoSocial: string; cnpj: string | null
  codigo: string | null; phone: string | null; cidade: string | null; estado: string | null
  capacidade: number | null; dono: string; cadastroEm: string
}

export default async function EstabelecimentosPage() {
  const res = await apiFetchServer('/api/admin/estabelecimentos')
  const { rows } = res.ok ? await res.json() as { rows: RowApi[] } : { rows: [] as RowApi[] }

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Estabelecimentos
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {rows.length} estabelecimento{rows.length !== 1 ? 's' : ''} cadastrado{rows.length !== 1 ? 's' : ''}
        </p>
      </div>
      <EstabelecimentosClient rows={rows} />
    </div>
  )
}
