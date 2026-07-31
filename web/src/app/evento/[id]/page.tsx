import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notFound }         from 'next/navigation'
import { Header }           from '@/components/layout/Header'
import { EventoPageClient } from './EventoPageClient'
import { isOrgAdmin } from '@/lib/orgAdmin'

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
      banner_url, organization_id, capacity,
      fee_mode, modulo_estacionamento, parent_event_id
    `)
    .eq('id', id)
    .single()

  if (!evento) notFound()

  // Verifica se o usuário logado é o dono do evento
  const { data: { user } } = await supabase.auth.getUser()
  let isOwner = false
  if (user && evento.organization_id) {
    isOwner = await isOrgAdmin(supabase, evento.organization_id, user.id)
  }

  // Rascunhos só são visíveis ao dono
  if (evento.status !== 'publicado' && !isOwner) notFound()

  // Evento filho (Tenda) — busca dados básicos do pai pro link de "Voltar"
  const { data: paiInfo } = evento.parent_event_id
    ? await supabase.from('events').select('id, title').eq('id', evento.parent_event_id).single()
    : { data: null }

  // Busca atrações (eventos filhos publicados) — só faz sentido pro pai, um
  // filho não pode ter filhos (regra já aplicada em criar-filho/route.ts)
  const { data: atracoes } = evento.parent_event_id
    ? { data: [] }
    : await supabase
        .from('events')
        .select('id, title, banner_url, date_start, ticket_mode, package_discount_pct, fee_mode')
        .eq('parent_event_id', id)
        .eq('status', 'publicado')
        .order('date_start')

  // Programação e ingressos de cada filho — carregados de uma vez pra exibir
  // tudo inline na mesma página (abas dentro de abas), sem precisar navegar
  // pra url própria de cada Tenda
  const childIds = (atracoes ?? []).map(a => a.id)
  const [{ data: childDias }, { data: childIngressos }] = childIds.length > 0
    ? await Promise.all([
        supabase
          .from('event_days')
          .select('id, event_id, day_number, date, start_time, end_time, banner_url, event_day_attractions(name, description, scheduled_time, order_index, image_url)')
          .in('event_id', childIds)
          .order('day_number'),
        supabase
          .from('event_tickets')
          .select('id, event_id, name, price, quantity, event_day_id')
          .in('event_id', childIds)
          .order('order_index'),
      ])
    : [{ data: [] }, { data: [] }]

  // Busca programação
  const { data: dias } = await supabase
    .from('event_days')
    .select('id, day_number, date, start_time, end_time, banner_url, event_day_attractions(name, description, scheduled_time, order_index, image_url)')
    .eq('event_id', id)
    .order('day_number')

  // Busca ingressos
  const { data: ingressos } = await supabase
    .from('event_tickets')
    .select('id, name, price, quantity, event_day_id')
    .eq('event_id', id)
    .order('order_index')

  // Busca a taxa da plataforma para exibir preços corretos quando fee_mode = 'comprador'
  const feeMode = (evento.fee_mode ?? 'promotor') as 'promotor' | 'comprador' | 'mista'
  let feePct = 10 // fallback

  if (feeMode === 'comprador') {
    const adminFee = createServiceClient()
    const { data: orgInfo } = await adminFee
      .from('events')
      .select('organization_id, organizations(owner_id)')
      .eq('id', id)
      .single()
    const orgRaw  = orgInfo?.organizations as unknown
    const orgData = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as { owner_id: string } | null
    const ownerId = orgData?.owner_id

    if (ownerId) {
      const { data: mpAcc } = await adminFee
        .from('promotor_mp_accounts')
        .select('fee_pct')
        .eq('user_id', ownerId)
        .maybeSingle()
      if (mpAcc?.fee_pct) { feePct = Number(mpAcc.fee_pct); }
      else {
        const { data: setting } = await adminFee
          .from('platform_settings')
          .select('value')
          .eq('key', 'default_fee_pct')
          .single()
        if (setting?.value) feePct = Number(setting.value)
      }
    }
  }

  // Busca atributos ativos do evento (para exibição pública na página)
  const { data: atributosRaw } = await supabase
    .from('event_attribute_values')
    .select('value_json, event_attributes(id, name, icon)')
    .eq('event_id', id)

  // Normaliza os dados — o join retorna o objeto aninhado como Record ou array
  type AttrJoin = { id: string; name: string; icon: string; value_json?: Record<string, string> | null }
  const atributosAtivos: AttrJoin[] = (atributosRaw ?? []).flatMap(row => {
    const a = row.event_attributes as unknown
    if (!a) return []
    const base = Array.isArray(a) ? (a as AttrJoin[]) : [a as AttrJoin]
    return base.map(attr => ({ ...attr, value_json: row.value_json as Record<string, string> | null ?? null }))
  })

  // Para o organizador: busca quantidades vendidas por tipo (usa service client — RLS bloquearia)
  // Inclui também os ingressos das Tendas — o painel de edição troca pro
  // ingresso ativo conforme a aba de show selecionada, então precisa do
  // vendido de ambos, não só do evento principal.
  let soldByTicket: Record<string, number> = {}
  const todosIngressoIds = [...(ingressos ?? []).map(t => t.id), ...(childIngressos ?? []).map(t => t.id)]
  if (isOwner && todosIngressoIds.length > 0) {
    const admin = createServiceClient()
    const ticketIds = todosIngressoIds
    const { data: soldRows } = await admin
      .from('order_items')
      .select('ticket_id, quantity, orders!inner(status)')
      .in('ticket_id', ticketIds)
      .eq('orders.status', 'approved')

    for (const row of soldRows ?? []) {
      soldByTicket[row.ticket_id] = (soldByTicket[row.ticket_id] ?? 0) + (row.quantity ?? 0)
    }
  }

  type AttractionRow = { name: string; description: string | null; scheduled_time: string | null; order_index: number; image_url: string | null }

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
          moduloEstacionamento: (evento as unknown as { modulo_estacionamento: boolean }).modulo_estacionamento ?? false,
          isChild:            (evento as unknown as { parent_event_id: string | null }).parent_event_id != null,
          parentEventId:      evento.parent_event_id ?? null,
          parentEventTitle:   paiInfo?.title ?? null,
          feeMode,
          feePct,
        }}
        dias={(dias ?? []).map(d => ({
          id:          d.id,
          dayNumber:   d.day_number,
          date:        d.date        ?? '',
          startTime:   d.start_time  ?? '',
          endTime:     d.end_time    ?? '',
          bannerUrl:   d.banner_url  ?? null,
          attractions: ((d.event_day_attractions as AttractionRow[]) ?? [])
            .sort((a, b) => a.order_index - b.order_index)
            .map(a => ({ name: a.name, description: a.description ?? '', scheduledTime: a.scheduled_time ?? '', imageUrl: a.image_url ?? null })),
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
        atributosAtivos={atributosAtivos}
        atracoes={(atracoes ?? []).map(a => ({
          id:                 a.id,
          title:              a.title      ?? 'Atração',
          bannerUrl:          a.banner_url ?? null,
          dateStart:          a.date_start ?? null,
          ticketMode:         (a.ticket_mode ?? null) as 'individual' | 'pacote' | 'ambos' | null,
          packageDiscountPct: a.package_discount_pct ?? 0,
          feeMode:            (a.fee_mode ?? 'promotor') as 'promotor' | 'comprador' | 'mista',
          dias: (childDias ?? [])
            .filter(d => d.event_id === a.id)
            .map(d => ({
              id:          d.id,
              dayNumber:   d.day_number,
              date:        d.date        ?? '',
              startTime:   d.start_time  ?? '',
              endTime:     d.end_time    ?? '',
              bannerUrl:   d.banner_url  ?? null,
              attractions: ((d.event_day_attractions as AttractionRow[]) ?? [])
                .sort((x, y) => x.order_index - y.order_index)
                .map(x => ({ name: x.name, description: x.description ?? '', scheduledTime: x.scheduled_time ?? '', imageUrl: x.image_url ?? null })),
            })),
          ingressos: (childIngressos ?? [])
            .filter(t => t.event_id === a.id)
            .map(t => ({
              id:         t.id,
              name:       t.name          ?? '',
              price:      t.price         ?? 0,
              quantity:   t.quantity      ?? 0,
              eventDayId: t.event_day_id  ?? null,
            })),
        }))}
      />
    </div>
  )
}
