import { createServiceClient } from '@/lib/supabase/server'
import { unstable_cache } from 'next/cache'
import { UsuariosClient } from './UsuariosClient'

type PerfilRow = {
  full_name: string | null; cpf: string | null; phone: string | null; user_code: string | null
  zip_code: string | null; street: string | null; street_number: string | null
  neighborhood: string | null; city: string | null; state: string | null; complement: string | null
}

type StatsRow = { user_id: string; qtd_compras: number; total_gasto: number }

// Monta a lista de usuários pro painel admin. Isso envolve uma chamada à API
// de Auth do Supabase (listUsers) + duas queries no banco — cara demais pra
// refazer do zero a cada vez que o admin abre a página. Por isso fica em
// cache por 1 minuto (tag "admin-usuarios"); o botão "Atualizar" na tela
// força a invalidação antes desse prazo quando necessário.
const getUsuarios = unstable_cache(
  async () => {
    const admin = createServiceClient()

    // Busca todos os usuários do Supabase Auth (email + data de cadastro)
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const authUsers = authData?.users ?? []

    const ids = authUsers.map(u => u.id)

    // Busca perfis e as compras já agregadas por usuário (view user_order_stats)
    // — o Postgres soma os pedidos aprovados, em vez de trazer cada linha e
    // somar em JavaScript.
    const [perfisRes, statsRes] = await Promise.all([
      ids.length
        ? admin.from('profiles').select('id, full_name, cpf, phone, user_code, zip_code, street, street_number, neighborhood, city, state, complement').in('id', ids)
        : Promise.resolve({ data: [] as (PerfilRow & { id: string })[] }),
      ids.length
        ? admin.from('user_order_stats').select('user_id, qtd_compras, total_gasto').in('user_id', ids)
        : Promise.resolve({ data: [] as StatsRow[] }),
    ])

    const perfilMap: Record<string, PerfilRow> = {}
    for (const p of perfisRes.data ?? []) perfilMap[p.id] = p

    const statsMap: Record<string, StatsRow> = {}
    for (const s of statsRes.data ?? []) statsMap[s.user_id] = s

    const rows = authUsers.map(u => {
      const p = perfilMap[u.id]
      const s = statsMap[u.id]

      // Endereço completo — usado no filtro "Endereço" e no tooltip da coluna Localização
      const endereco = [p?.street, p?.street_number, p?.neighborhood, p?.complement]
        .filter(Boolean).join(', ')

      return {
        id:          u.id,
        email:       u.email ?? '—',
        nome:        p?.full_name ?? u.user_metadata?.full_name ?? '—',
        cpf:         p?.cpf ?? null,
        phone:       p?.phone ?? null,
        userCode:    p?.user_code ?? null,
        cadastroEm:  u.created_at,
        qtdCompras:  s?.qtd_compras ?? 0,
        totalGasto:  s?.total_gasto ?? 0,
        cep:         p?.zip_code ?? null,
        endereco:    endereco || null,
        cidade:      p?.city  ?? null,
        estado:      p?.state ?? null,
      }
    })

    // Mais recentes primeiro
    rows.sort((a, b) => new Date(b.cadastroEm).getTime() - new Date(a.cadastroEm).getTime())

    return rows
  },
  ['admin-usuarios'],
  { revalidate: 60, tags: ['admin-usuarios'] },
)

export default async function UsuariosPage() {
  const rows = await getUsuarios()

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Usuários
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {rows.length} usuário{rows.length !== 1 ? 's' : ''} cadastrado{rows.length !== 1 ? 's' : ''}
        </p>
      </div>
      <UsuariosClient rows={rows} />
    </div>
  )
}
