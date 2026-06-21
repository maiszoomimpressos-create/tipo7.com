'use client'

// Lista de ingressos agrupada por evento, com modal de detalhes e portadores
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ticket, CalendarDays, MapPin, Users } from 'lucide-react'
import { EventModal } from './EventModal'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type TicketHolder = {
  slot_number: number
  full_name:   string
  cpf:         string
  email:       string
  birth_date:  string
}

type OrderItem = {
  id:              string
  quantity:        number
  unit_price:      number
  event_tickets:   { id: string; name: string } | null
  ticket_holders:  TicketHolder[]
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

export type EventGroup = {
  event:         Order['events']
  orders:        Order[]
  items:         { item: OrderItem; orderId: string }[]
  totalTickets:  number
  totalPaid:     number
  allApproved:   boolean
  holdersFilled: number
}

interface Props {
  orders: Order[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function formatDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

function groupByEvent(orders: Order[]): EventGroup[] {
  const map = new Map<string, EventGroup>()

  for (const order of orders) {
    const eventId = order.events?.id ?? '__sem_evento__'
    if (!map.has(eventId)) {
      map.set(eventId, {
        event:         order.events,
        orders:        [],
        items:         [],
        totalTickets:  0,
        totalPaid:     0,
        allApproved:   true,
        holdersFilled: 0,
      })
    }
    const group = map.get(eventId)!
    group.orders.push(order)
    if (order.status !== 'approved') group.allApproved = false
    group.totalPaid += Number(order.total)

    for (const item of order.order_items) {
      group.items.push({ item, orderId: order.id })
      group.totalTickets  += item.quantity
      group.holdersFilled += (item.ticket_holders ?? []).length
    }
  }

  return Array.from(map.values())
}

// ---------------------------------------------------------------------------
// Card de evento
// ---------------------------------------------------------------------------

function EventCard({ group, onClick }: { group: EventGroup; onClick: () => void }) {
  const ev          = group.event
  const allFilled   = group.holdersFilled >= group.totalTickets
  const needHolders = group.allApproved && !allFilled

  return (
    <button type="button" onClick={onClick} className="w-full text-left group cursor-pointer">
      <div
        className="relative overflow-hidden rounded-2xl transition-all duration-200 group-hover:border-[#2a2a2a]"
        style={{ border: '1px solid #1a1a1a', background: '#0d0d0d' }}
      >
        {/* Banner */}
        <div className="relative" style={{ aspectRatio: '780/380' }}>
          {ev?.banner_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ev.banner_url}
              alt={ev.title ?? ''}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="w-full h-full" style={{ background: '#111' }} />
          )}

          {/* Gradiente de baixo */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 30%, rgba(7,7,7,0.97) 100%)' }}
          />

          {/* Badge quantidade — topo DIREITO */}
          <div className="absolute top-3.5 right-3.5">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-[#070707]"
              style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
            >
              <Ticket size={11} />
              {group.totalTickets} {group.totalTickets === 1 ? 'ingresso' : 'ingressos'}
            </span>
          </div>

          {/* Info do evento */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
            <h3
              className="text-white text-lg leading-snug mb-1.5"
              style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}
            >
              {ev?.title ?? 'Evento'}
            </h3>
            <div className="flex flex-col gap-1">
              {ev?.date_start && (
                <div className="flex items-center gap-1.5 text-[#888] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  <CalendarDays size={11} className="shrink-0" />
                  {formatDate(ev.date_start)}
                </div>
              )}
              {(ev?.venue_name || ev?.city) && (
                <div className="flex items-center gap-1.5 text-[#888] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  <MapPin size={11} className="shrink-0" />
                  {[ev.venue_name, ev.city, ev.state].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Aviso portadores pendentes */}
        {needHolders && (
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderTop: '1px solid rgba(232,184,75,0.12)', background: 'rgba(232,184,75,0.04)' }}
          >
            <Users size={14} className="text-[#E8B84B] shrink-0" />
            <p className="text-[#E8B84B] text-xs flex-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Informe quem vai usar os ingressos
            </p>
            <span className="text-[#E8B84B]/40 text-xs">→</span>
          </div>
        )}
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function MeusIngressosClient({ orders }: Props) {
  const router = useRouter()
  const [activeGroup, setActiveGroup] = useState<EventGroup | null>(null)

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

  const groups = groupByEvent(orders)

  return (
    <>
      <div className="space-y-4">
        {groups.map((group, i) => (
          <EventCard
            key={group.event?.id ?? i}
            group={group}
            onClick={() => setActiveGroup(group)}
          />
        ))}
      </div>

      {activeGroup && (
        <EventModal
          group={activeGroup}
          onClose={() => setActiveGroup(null)}
          onSaved={() => {
            setActiveGroup(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
