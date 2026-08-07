// Página "Meus Ingressos" — lista todos os pedidos do comprador com status e detalhes
import { getAuthUser }   from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect }      from 'next/navigation'
import { Header }        from '@/components/layout/Header'
import { Ticket }        from 'lucide-react'
import { MeusIngressosClient, type Order } from './MeusIngressosClient'

export default async function MeusIngressosPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/meus-ingressos')

  // GET /orders/minhas já devolve no mesmo shape snake_case que essa página
  // montava manualmente via join direto (Fase 7.2, G10).
  const res = await apiFetchServer('/api/orders/minhas')
  const { orders } = res.ok ? await res.json() as { orders: Order[] } : { orders: [] as Order[] }

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-12">

        <div className="mb-8 flex items-center gap-3">
          <Ticket size={22} className="text-[#E8B84B]" />
          <div>
            <h1
              className="text-2xl text-white leading-tight"
              style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}
            >
              Meus ingressos
            </h1>
            <p className="text-[#444] text-sm mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Todos os seus pedidos e ingressos comprados
            </p>
          </div>
        </div>

        <MeusIngressosClient orders={orders} />

      </main>
    </div>
  )
}
