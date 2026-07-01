import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notFound }      from 'next/navigation'
import { Header }        from '@/components/layout/Header'
import { EventoPageClient } from './EventoPageClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EventoPage({ params }: Props) {
  const { id }   = await params
  const supabase = await createClient()

  // Busca evento (público)
  const { data: evento } = await supabase
    .from('events')
    .select(`
      id, title, description, category, status,
      date_start, date_end,
      venue_name, city, state, street,
      ticket_mode, package_discount_pct,
      banner_url, organization_id, capacity
    `)
    .eq('id', id)
    .single()

  if (!evento) notFound()

  // Verifica se o usuário logado é o dono do evento
  const { data: { user } } = await supabase.auth.getUser()
  let isOwner = false
  if (user && evento.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('owner_id')
      .eq('id', evento.organization_id)
      .single()
    isOwner = org?.owner_id === user.id
  }

  // Rascunhos só são visíveis ao dono
  if (evento.status !== 'publicado' && !isOwner) notFound()

  // Busca programação
  const { data: dias } = await supabase
    .from('event_days')
    .select('id, day_number, date, start_time, end_time, event_day_attractions(name, scheduled_time, order_index)')
    .eq('event_id', id)
    .order('day_number')

  // Busca ingressos
  const { data: ingressos } = await supabase
    .from('event_tickets')
    .select('id, name, price, quantity, event_day_id')
    .eq('event_id', id)
    .order('order_index')

  // Para o organizador: busca quantidades vendidas por tipo (usa service client — RLS bloquearia)
  let soldByTicket: Record<string, number> = {}
  if (isOwner && ingressos && ingressos.length > 0) {
    const admin = createServiceClient()
    const ticketIds = ingressos.map(t => t.id)
    const { data: soldRows } = await admin
      .from('order_items')
      .select('ticket_id, quantity, orders!inner(status)')
      .in('ticket_id', ticketIds)
      .eq('orders.status', 'approved')

    for (const row of soldRows ?? []) {
      soldByTicket[row.ticket_id] = (soldByTicket[row.ticket_id] ?? 0) + (row.quantity ?? 0)
    }
  }

  type AttractionRow = { name: string; scheduled_time: string | null; order_index: number }

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />
      <EventoPageClient
        evento={{
          id:                 evento.id,
          title:              evento.title              ?? '',
          description:        evento.description        ?? '',
          category:           evento.category           ?? '',
          status:             evento.status as 'rascunho' | 'publicado' | 'cancelado',
          dateStart:          evento.date_start         ?? '',
          dateEnd:            evento.date_end           ?? '',
          venueName:          evento.venue_name         ?? '',
          city:               evento.city               ?? '',
          state:              evento.state              ?? '',
          street:             evento.street             ?? '',
          ticketMode:         (evento.ticket_mode ?? null) as 'individual' | 'pacote' | 'ambos' | null,
          packageDiscountPct: evento.package_discount_pct ?? 0,
          bannerUrl:          evento.banner_url         ?? null,
        }}
        dias={(dias ?? []).map(d => ({
          id:          d.id,
          dayNumber:   d.day_number,
          date:        d.date        ?? '',
          startTime:   d.start_time  ?? '',
          endTime:     d.end_time    ?? '',
          attractions: ((d.event_day_attractions as AttractionRow[]) ?? [])
            .sort((a, b) => a.order_index - b.order_index)
            .map(a => ({ name: a.name, scheduledTime: a.scheduled_time ?? '' })),
        }))}
        ingressos={(ingressos ?? []).map(t => ({
          id:         t.id,
          name:       t.name          ?? '',
          price:      t.price         ?? 0,
          quantity:   t.quantity      ?? 0,
          eventDayId: t.event_day_id  ?? null,
        }))}
        isOwner={isOwner}
        capacity={evento.capacity ?? null}
        soldByTicket={soldByTicket}
      />
    </div>
  )
}
