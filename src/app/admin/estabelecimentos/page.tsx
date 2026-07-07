import { createServiceClient } from '@/lib/supabase/server'
import { EstabelecimentosClient } from './EstabelecimentosClient'

export default async function EstabelecimentosPage() {
  const admin = createServiceClient()

  const { data: orgs } = await admin
    .from('organizations')
    .select('id, name, nome_fantasia, cnpj, codigo, phone, city, state, capacity, owner_id, created_at, profiles!owner_id ( full_name )')
    .eq('type', 'estabelecimento')
    .order('created_at', { ascending: false })

  const rows = (orgs ?? []).map(org => {
    const profile = Array.isArray(org.profiles) ? org.profiles[0] : org.profiles
    return {
      id:           org.id,
      nome:         org.nome_fantasia ?? org.name,
      razaoSocial:  org.name,
      cnpj:         org.cnpj ?? null,
      codigo:       org.codigo ?? null,
      phone:        org.phone ?? null,
      cidade:       org.city ?? null,
      estado:       org.state ?? null,
      capacidade:   org.capacity ?? null,
      dono:         (profile as { full_name: string | null } | null)?.full_name ?? '—',
      cadastroEm:   org.created_at,
    }
  })

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
