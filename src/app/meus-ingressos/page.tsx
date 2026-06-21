// Página "Meus Ingressos" — lista todos os pedidos do comprador com status e detalhes
import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { Header }        from '@/components/layout/Header'
import { Ticket }        from 'lucide-react'
import { MeusIngressosClient } from './MeusIngressosClient'

export default async function MeusIngressosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/meus-ingressos')

  // Busca pedidos com evento, itens e portadores já cadastrados
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      total,
      created_at,
      mp_payment_id,
      events (
        id,
        title,
        date_start,
        banner_url,
        venue_name,
        city,
        state
      ),
      order_items (
        id,
        quantity,
        unit_price,
        event_tickets (
          id,
          name
        ),
        ticket_holders (
          slot_number,
          full_name,
          cpf,
          email,
          birth_date
        )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

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

        <MeusIngressosClient orders={(orders ?? []) as unknown as import('./MeusIngressosClient').Order[]} />

      </main>
    </div>
  )
}
