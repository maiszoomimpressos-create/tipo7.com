'use client'

// Lista de pedidos do comprador com status, evento e ingressos
import { CalendarDays, MapPin, Ticket, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Tipos inferidos do Supabase
// ---------------------------------------------------------------------------

type OrderItem = {
  id:          string
  quantity:    number
  unit_price:  number
  event_tickets: { id: string; name: string } | null
}

export type Order = {
  id:            string
  status:        string
  total:         number
  created_at:    string
  mp_payment_id: string | null
  events: {
    id:         string
    title:      string | null
    date_start: string | null
    banner_url: string | null
    venue_name: string | null
    city:       string | null
    state:      string | null
  } | null
  order_items: OrderItem[]
}

interface Props {
  orders: Order[]
}

// ---------------------------------------------------------------------------
// Helpers de status
// ---------------------------------------------------------------------------

const STATUS = {
  approved: {
    label: 'Aprovado',
    icon:  CheckCircle2,
    color: 'text-green-400',
    bg:    'bg-green-400/10 border-green-400/20',
  },
  in_process: {
    label: 'Em processamento',
    icon:  Clock,
    color: 'text-yellow-400',
    bg:    'bg-yellow-400/10 border-yellow-400/20',
  },
  pending: {
    label: 'Pendente',
    icon:  Clock,
    color: 'text-yellow-400',
    bg:    'bg-yellow-400/10 border-yellow-400/20',
  },
  rejected: {
    label: 'Recusado',
    icon:  XCircle,
    color: 'text-red-400',
    bg:    'bg-red-400/10 border-red-400/20',
  },
  cancelled: {
    label: 'Cancelado',
    icon:  XCircle,
    color: 'text-red-400',
    bg:    'bg-red-400/10 border-red-400/20',
  },
} as const

type StatusKey = keyof typeof STATUS

function getStatus(s: string) {
  return STATUS[s as StatusKey] ?? {
    label: s,
    icon:  AlertCircle,
    color: 'text-[#555]',
    bg:    'bg-white/5 border-white/10',
  }
}

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function formatDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function MeusIngressosClient({ orders }: Props) {

  if (orders.length === 0) {
    return (
      <div className="text-center py-20">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.15)' }}
        >
          <Ticket size={28} className="text-[#E8B84B]/50" />
        </div>
        <h2 className="text-white text-lg mb-2" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
          Nenhum ingresso ainda
        </h2>
        <p className="text-[#444] text-sm mb-6" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Quando você comprar ingressos, eles aparecerão aqui.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-[#070707]"
          style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
        >
          Explorar eventos
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map(order => {
        const st      = getStatus(order.status)
        const Icon    = st.icon
        const evento  = order.events
        const dataPedido = formatDate(order.created_at)

        return (
          <div
            key={order.id}
            className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden"
          >
            {/* Banner do evento — topo do card */}
            {evento?.banner_url ? (
              <div className="relative h-28 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={evento.banner_url}
                  alt={evento.title ?? ''}
                  className="w-full h-full object-cover brightness-75"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d]/30 to-transparent" />
                {/* Status badge sobre o banner */}
                <div className="absolute top-3 right-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${st.bg} ${st.color}`}
                    style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    <Icon size={11} />
                    {st.label}
                  </span>
                </div>
              </div>
            ) : (
              /* Sem banner: faixa de status no topo */
              <div className={`flex items-center justify-between px-5 py-3 border-b border-[#131313]`}>
                <span className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Pedido • {dataPedido}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${st.bg} ${st.color}`}
                  style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  <Icon size={11} />
                  {st.label}
                </span>
              </div>
            )}

            <div className="px-5 py-4">

              {/* Nome do evento */}
              <h3
                className="text-white font-medium mb-3 leading-snug"
                style={{ fontFamily: 'var(--font-outfit)' }}
              >
                {evento?.title ?? 'Evento'}
              </h3>

              {/* Data e local */}
              <div className="flex flex-col gap-1.5 mb-4">
                {evento?.date_start && (
                  <div className="flex items-center gap-2 text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    <CalendarDays size={13} className="shrink-0" />
                    {formatDate(evento.date_start)}
                  </div>
                )}
                {(evento?.venue_name || evento?.city) && (
                  <div className="flex items-center gap-2 text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    <MapPin size={13} className="shrink-0" />
                    {[evento.venue_name, evento.city, evento.state].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>

              {/* Lista de ingressos */}
              <div className="border-t border-[#131313] pt-3 mb-3 space-y-2">
                {order.order_items.map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ticket size={13} className="text-[#333] shrink-0" />
                      <span className="text-[#bbb] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {item.event_tickets?.name ?? 'Ingresso'}
                      </span>
                      <span className="text-[#333] text-xs">×{item.quantity}</span>
                    </div>
                    <span className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {formatMoney(Number(item.unit_price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Rodapé: total + link para o evento */}
              <div className="flex items-center justify-between pt-3 border-t border-[#131313]">
                <div>
                  <p className="text-[#333] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>Total pago</p>
                  <p className="text-[#E8B84B] font-semibold text-sm" style={{ fontFamily: 'var(--font-syne)' }}>
                    {formatMoney(Number(order.total))}
                  </p>
                </div>
                {evento?.id && order.status === 'approved' && (
                  <a
                    href={`/evento/${evento.id}`}
                    className="text-xs text-[#444] hover:text-white transition-colors border border-[#222] hover:border-[#333] px-3 py-1.5 rounded-lg"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    Ver evento
                  </a>
                )}
              </div>

            </div>
          </div>
        )
      })}
    </div>
  )
}
