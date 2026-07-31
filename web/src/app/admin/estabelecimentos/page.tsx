import { createServiceClient } from '@/lib/supabase/server'
import { EstabelecimentosClient } from './EstabelecimentosClient'

interface VenueAdminRow {
  status:   string
  profiles: { full_name: string | null } | { full_name: string | null }[] | null
}

export default async function EstabelecimentosPage() {
  const admin = createServiceClient()

  // "Estabelecimento" hoje é um venue com pelo menos um administrador
  // (venue_admins) — não é mais organizations.type='estabelecimento'.
  // O !inner garante que só entram venues que têm administrador de fato;
  // um endereço solto do Google Places (sem ninguém responsável) não é
  // um "estabelecimento", é só um local de evento.
  const { data: venues } = await admin
    .from('venues')
    .select(`
      id, name, nome_fantasia, cnpj, codigo, phone, city, state, capacity, created_at,
      venue_admins!inner ( status, profiles ( full_name ) )
    `)
    .eq('venue_admins.status', 'ativo')
    .order('created_at', { ascending: false })

  const rows = (venues ?? []).map(venue => {
    const admins = venue.venue_admins as unknown as VenueAdminRow[]
    const profile = admins[0] ? (Array.isArray(admins[0].profiles) ? admins[0].profiles[0] : admins[0].profiles) : null
    return {
      id:           venue.id,
      nome:         venue.nome_fantasia ?? venue.name,
      razaoSocial:  venue.name,
      cnpj:         venue.cnpj ?? null,
      codigo:       venue.codigo ?? null,
      phone:        venue.phone ?? null,
      cidade:       venue.city ?? null,
      estado:       venue.state ?? null,
      capacidade:   venue.capacity ?? null,
      dono:         profile?.full_name ?? '—',
      cadastroEm:   venue.created_at,
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
