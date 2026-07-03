import { createServiceClient } from '@/lib/supabase/server'
import { UsuariosClient } from './UsuariosClient'

export default async function UsuariosPage() {
  const admin = createServiceClient()

  // Busca todos os usuários do Supabase Auth (email + data de cadastro)
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authUsers = authData?.users ?? []

  const ids = authUsers.map(u => u.id)

  // Busca perfis e pedidos aprovados em paralelo
  const [perfisRes, pedidosRes] = await Promise.all([
    ids.length
      ? admin.from('profiles').select('id, full_name, cpf, phone').in('id', ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? admin.from('orders').select('user_id, total').eq('status', 'approved').in('user_id', ids)
      : Promise.resolve({ data: [] }),
  ])

  const perfilMap: Record<string, { full_name: string | null; cpf: string | null; phone: string | null }> = {}
  for (const p of perfisRes.data ?? []) perfilMap[p.id] = p

  const comprasPorUser: Record<string, { qtd: number; total: number }> = {}
  for (const o of pedidosRes.data ?? []) {
    const prev = comprasPorUser[o.user_id] ?? { qtd: 0, total: 0 }
    comprasPorUser[o.user_id] = { qtd: prev.qtd + 1, total: prev.total + Number(o.total) }
  }

  const rows = authUsers.map(u => {
    const p = perfilMap[u.id]
    const c = comprasPorUser[u.id]
    return {
      id:          u.id,
      email:       u.email ?? '—',
      nome:        p?.full_name ?? u.user_metadata?.full_name ?? '—',
      cpf:         p?.cpf ?? null,
      phone:       p?.phone ?? null,
      cadastroEm:  u.created_at,
      qtdCompras:  c?.qtd ?? 0,
      totalGasto:  c?.total ?? 0,
    }
  })

  // Mais recentes primeiro
  rows.sort((a, b) => new Date(b.cadastroEm).getTime() - new Date(a.cadastroEm).getTime())

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
