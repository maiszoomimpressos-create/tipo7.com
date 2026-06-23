import { createServiceClient } from '@/lib/supabase/server'
import { TrendingUp, Users, Ticket, DollarSign } from 'lucide-react'

function fmt(n: number, currency = false) {
  if (currency) return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return n.toLocaleString('pt-BR')
}

export default async function AdminHomePage() {
  const admin = createServiceClient()

  const [
    { count: totalEventos },
    { count: eventosAtivos },
    { count: totalPromotores },
    { count: mpConectados },
    { data: orders },
  ] = await Promise.all([
    admin.from('events').select('*', { count: 'exact', head: true }),
    admin.from('events').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    admin.from('promotor_profiles').select('*', { count: 'exact', head: true }),
    admin.from('promotor_mp_accounts').select('*', { count: 'exact', head: true }),
    admin.from('orders').select('total').eq('status', 'approved'),
  ])

  const totalRevenue      = (orders ?? []).reduce((s, o) => s + Number(o.total), 0)
  const plataformaRevenue = totalRevenue * 0.1

  const cards = [
    {
      label: 'Eventos publicados',
      value: fmt(eventosAtivos ?? 0),
      sub:   `${fmt(totalEventos ?? 0)} cadastrados no total`,
      icon:  TrendingUp,
      color: '#E8B84B',
    },
    {
      label: 'Promotores',
      value: fmt(totalPromotores ?? 0),
      sub:   `${fmt(mpConectados ?? 0)} com Mercado Pago conectado`,
      icon:  Users,
      color: '#60a5fa',
    },
    {
      label: 'Volume de vendas',
      value: fmt(totalRevenue, true),
      sub:   'soma dos pedidos aprovados',
      icon:  DollarSign,
      color: '#4ade80',
    },
    {
      label: 'Receita da plataforma',
      value: fmt(plataformaRevenue, true),
      sub:   'estimativa baseada em 10% de taxa',
      icon:  Ticket,
      color: '#f472b6',
    },
  ]

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Visão geral
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Métricas gerais da plataforma Tipo7
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {cards.map(card => (
          <div key={card.label} className="rounded-2xl p-6" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[#555] text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {card.label}
              </p>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${card.color}18` }}>
                <card.icon size={15} style={{ color: card.color }} />
              </div>
            </div>
            <p className="text-white text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-syne)' }}>
              {card.value}
            </p>
            <p className="text-[#333] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {card.sub}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
