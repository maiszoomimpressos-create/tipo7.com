import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { DashboardClient, type DashboardData } from './DashboardClient'

interface Props {
  params: Promise<{ eventoId: string }>
}

export default async function DashboardPage({ params }: Props) {
  const { eventoId } = await params
  const supabase     = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?next=/dashboard/${eventoId}`)

  const admin = createServiceClient()

  // Busca evento e verifica se o usuário é o organizador
  const { data: evento } = await admin
    .from('events')
    .select('id, title, date_start, organization_id')
    .eq('id', eventoId)
    .single()

  if (!evento) notFound()

  const { data: org } = await admin
    .from('organizations')
    .select('owner_id')
    .eq('id', evento.organization_id)
    .single()

  if (org?.owner_id !== user.id) {
    redirect(`/evento/${eventoId}`)
  }

  // ── Busca todos os pedidos aprovados do evento ────────────────────────────
  const { data: orders } = await admin
    .from('orders')
    .select(`
      id, total, created_at,
      profiles:user_id (full_name),
      order_items (
        id, quantity, unit_price,
        event_tickets (id, name)
      )
    `)
    .eq('event_id', eventoId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  // ── Busca check-ins realizados por order_item ─────────────────────────────
  const { data: tickets } = await admin
    .from('tickets')
    .select('order_item_id, status')
    .eq('event_id', eventoId)

  // Agrupa check-ins por order_item_id
  const checkInsByItem: Record<string, number> = {}
  for (const t of tickets ?? []) {
    if (t.status === 'used') {
      checkInsByItem[t.order_item_id] = (checkInsByItem[t.order_item_id] ?? 0) + 1
    }
  }

  // ── Busca tipos de ingressos para o resumo por tipo ───────────────────────
  const { data: tiposIngressos } = await admin
    .from('event_tickets')
    .select('id, name, quantity')
    .eq('event_id', eventoId)
    .order('order_index')

  // ── Agrega dados ──────────────────────────────────────────────────────────

  let totalArrecadado    = 0
  let ingressosVendidos  = 0
  let checkInsRealizados = 0

  const vendasPorDiaMap: Record<string, { quantidade: number; valor: number }> = {}
  const porTipoMap:      Record<string, { vendidos: number; valor: number; checkIns: number }> = {}
  const compradores: DashboardData['compradores'] = []

  for (const order of orders ?? []) {
    const profileData = order.profiles as unknown as { full_name: string | null } | null
    const buyerName   = profileData?.full_name ?? 'Comprador'
    const dateKey     = order.created_at.slice(0, 10)

    totalArrecadado += Number(order.total)

    if (!vendasPorDiaMap[dateKey]) vendasPorDiaMap[dateKey] = { quantidade: 0, valor: 0 }
    vendasPorDiaMap[dateKey].valor += Number(order.total)

    const items = order.order_items as unknown as {
      id: string; quantity: number; unit_price: number
      event_tickets: { id: string; name: string } | null
    }[]

    for (const item of items ?? []) {
      const ticketData  = item.event_tickets
      const ticketName  = ticketData?.name ?? 'Ingresso'
      const ticketId    = ticketData?.id   ?? 'unknown'
      const itemCheckIns = checkInsByItem[item.id] ?? 0

      ingressosVendidos  += item.quantity
      checkInsRealizados += itemCheckIns

      vendasPorDiaMap[dateKey].quantidade += item.quantity

      if (!porTipoMap[ticketId]) porTipoMap[ticketId] = { vendidos: 0, valor: 0, checkIns: 0 }
      porTipoMap[ticketId].vendidos += item.quantity
      porTipoMap[ticketId].valor    += item.quantity * Number(item.unit_price)
      porTipoMap[ticketId].checkIns += itemCheckIns

      compradores.push({
        orderId:    order.id,
        buyerName,
        ticketName,
        quantity:   item.quantity,
        unitPrice:  Number(item.unit_price),
        total:      item.quantity * Number(item.unit_price),
        createdAt:  order.created_at,
        checkIns:   itemCheckIns,
      })
    }
  }

  // Vendas por dia — últimos 30 dias (ou desde a criação do evento)
  const vendasPorDia = Object.entries(vendasPorDiaMap)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Por tipo de ingresso
  const porTipo = (tiposIngressos ?? []).map(t => ({
    id:       t.id,
    name:     t.name ?? 'Ingresso',
    total:    t.quantity ?? 0,
    vendidos: porTipoMap[t.id]?.vendidos ?? 0,
    valor:    porTipoMap[t.id]?.valor    ?? 0,
    checkIns: porTipoMap[t.id]?.checkIns ?? 0,
  }))

  const data: DashboardData = {
    evento:   { id: evento.id, title: evento.title ?? 'Evento', dateStart: evento.date_start },
    resumo:   { totalArrecadado, ingressosVendidos, checkInsRealizados },
    vendasPorDia,
    porTipo,
    compradores,
  }

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />
      <DashboardClient data={data} />
    </div>
  )
}
