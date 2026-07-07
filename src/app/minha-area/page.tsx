import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PromoterLayout } from '@/components/layout/PromoterLayout'
import { DashboardClient } from './DashboardClient'
import type { Comprador, EventoResumo, TipoIngresso } from './DashboardClient'

export default async function MinhaAreaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/minha-area')

  const admin = createServiceClient()

  // Todas as organizações do usuário (pode ter promotora + estabelecimento)
  const { data: orgsData } = await admin
    .from('organizations')
    .select('id, name, codigo, type')
    .eq('owner_id', user.id)

  const orgs = orgsData ?? []
  if (orgs.length === 0) redirect('/criar-evento')

  // Usa a primeira org para nome/código de exibição (preferindo promotora)
  const org = orgs.find(o => o.type === 'promotora') ?? orgs[0]
  const orgIds = orgs.map(o => o.id)

  // Todos os eventos de todas as orgs do usuário
  const { data: eventosRaw } = await admin
    .from('events')
    .select('id, title, status, date_start, date_end, banner_url, category')
    .in('organization_id', orgIds)
    .order('created_at', { ascending: false })

  const eventos: EventoResumo[] = (eventosRaw ?? []).map(e => ({
    id:         e.id,
    title:      e.title       ?? 'Sem título',
    status:     e.status      ?? 'rascunho',
    date_start: e.date_start  ?? null,
    banner_url: (e as unknown as { banner_url: string | null }).banner_url ?? null,
    category:   e.category    ?? null,
  }))

  const eventoIds = eventos.map(e => e.id)

  // Sem eventos ainda
  if (eventoIds.length === 0) {
    return (
      <div className="min-h-dvh bg-[#070707] flex flex-col">
        <Header />
        <PromoterLayout>
          <main className="flex-1">
            <DashboardClient
              orgName={org.name ?? 'Minha organização'}
              orgCodigo={(org as { codigo?: string | null }).codigo ?? null}
              orgTipo={(org as { type?: string | null }).type as 'promotora' | 'estabelecimento' | null}
              eventos={[]} kpis={{ receita: 0, vendidos: 0, checkins: 0, totalEventos: 0 }} tiposIngresso={[]} compradores={[]}
            />
          </main>
          <Footer />
        </PromoterLayout>
      </div>
    )
  }

  // Pedidos aprovados
  const { data: ordersRaw } = await admin
    .from('orders')
    .select('id, event_id, total, created_at')
    .in('event_id', eventoIds)
    .eq('status', 'approved')

  const orders = ordersRaw ?? []
  const orderIds = orders.map(o => o.id)

  // Itens dos pedidos + tipo de ingresso
  const { data: itemsRaw } = orderIds.length > 0
    ? await admin
        .from('order_items')
        .select('id, order_id, ticket_id, quantity, unit_price, event_tickets(id, name, event_id)')
        .in('order_id', orderIds)
    : { data: [] as never[] }

  const items = itemsRaw ?? []
  const itemIds = items.map((i: { id: string }) => i.id)

  // Dados dos compradores (ticket_holders)
  const { data: holdersRaw } = itemIds.length > 0
    ? await admin
        .from('ticket_holders')
        .select('order_item_id, slot_number, full_name, email, cpf, birth_date')
        .in('order_item_id', itemIds)
    : { data: [] as never[] }

  // Status individual de cada ingresso
  const { data: ticketsRaw } = orderIds.length > 0
    ? await admin
        .from('tickets')
        .select('order_id, order_item_id, slot_number, status, validated_at')
        .in('order_id', orderIds)
    : { data: [] as never[] }

  // Tipos de ingresso por evento (para filtro)
  const { data: tiposRaw } = await admin
    .from('event_tickets')
    .select('id, event_id, name')
    .in('event_id', eventoIds)

  // Mapas auxiliares
  const ticketMap = new Map<string, { status: string; validated_at: string | null }>()
  for (const t of (ticketsRaw ?? [])) {
    ticketMap.set(`${t.order_item_id}_${t.slot_number}`, {
      status:       t.status,
      validated_at: t.validated_at,
    })
  }

  const orderEventMap = new Map<string, string>()
  const orderDateMap  = new Map<string, string>()
  for (const o of orders) {
    orderEventMap.set(o.id, o.event_id)
    orderDateMap.set(o.id, o.created_at)
  }

  const eventoTitleMap = new Map<string, string>()
  for (const e of eventos) eventoTitleMap.set(e.id, e.title)

  const itemOrderMap = new Map<string, string>()
  const itemTicketNameMap = new Map<string, string>()
  const itemEventIdMap = new Map<string, string>()

  for (const item of items) {
    itemOrderMap.set(item.id, item.order_id)
    const et = Array.isArray(item.event_tickets)
      ? (item.event_tickets[0] as { name: string; event_id: string } | null)
      : (item.event_tickets as { name: string; event_id: string } | null)
    itemTicketNameMap.set(item.id, et?.name ?? 'Ingresso')
    itemEventIdMap.set(item.id, et?.event_id ?? orderEventMap.get(item.order_id) ?? '')
  }

  // Lista de compradores
  const compradores: Comprador[] = []
  for (const h of (holdersRaw ?? [])) {
    const orderId   = itemOrderMap.get(h.order_item_id)
    if (!orderId) continue
    const eventId   = itemEventIdMap.get(h.order_item_id) ?? orderEventMap.get(orderId) ?? ''
    const tStatus   = ticketMap.get(`${h.order_item_id}_${h.slot_number}`)
    compradores.push({
      nome:         h.full_name,
      email:        h.email,
      birth_date:   h.birth_date ?? null,
      ticket_type:  itemTicketNameMap.get(h.order_item_id) ?? 'Ingresso',
      event_id:     eventId,
      event_title:  eventoTitleMap.get(eventId) ?? '',
      status:       tStatus?.status       ?? 'valid',
      validated_at: tStatus?.validated_at ?? null,
      data_compra:  orderDateMap.get(orderId) ?? '',
    })
  }

  // KPIs
  const receita  = orders.reduce((s, o) => s + ((o as unknown as { total: number }).total ?? 0), 0)
  const vendidos = items.reduce((s, i: { quantity: number }) => s + (i.quantity ?? 0), 0)
  const checkins = (ticketsRaw ?? []).filter((t: { status: string }) => t.status === 'used').length

  const tiposIngresso: TipoIngresso[] = (tiposRaw ?? []).map(t => ({
    id:       t.id,
    event_id: t.event_id,
    name:     t.name,
  }))

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col">
      <Header />
      <PromoterLayout>
        <main className="flex-1">
          <DashboardClient
            orgName={org.name ?? 'Minha organização'}
            orgCodigo={(org as { codigo?: string | null }).codigo ?? null}
            orgTipo={(org as { type?: string | null }).type as 'promotora' | 'estabelecimento' | null}
            eventos={eventos}
            kpis={{ receita, vendidos, checkins, totalEventos: eventos.length }}
            tiposIngresso={tiposIngresso}
            compradores={compradores}
          />
        </main>
        <Footer />
      </PromoterLayout>
    </div>
  )
}
