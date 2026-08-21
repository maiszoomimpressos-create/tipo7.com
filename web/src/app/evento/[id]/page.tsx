import { getAuthUser }      from '@/lib/auth/server'
import { apiFetchServer }   from '@/lib/apiFetchServer'
import { notFound }         from 'next/navigation'
import { Header }           from '@/components/layout/Header'
import { EventoPageClient } from './EventoPageClient'
import { isOrgAdmin } from '@/lib/orgAdmin'

interface Props {
  params: Promise<{ id: string }>
}

// Fase 7.2-b (07/08/2026) — porte pro NestJS. Era a última página pública
// grande ainda falando direto com a Supabase (11 chamadas); GET /eventos/:id,
// /eventos/:id/dias e /eventos/:id/atributos já existiam desde a Fase 7.1
// mas nunca tinham sido conectados aqui. Ver [[project_migracao_nestjs_prisma]].
interface EventoCoreApi {
  id: string; title: string; description: string | null; category: string | null; status: string
  date_start: string | null; date_end: string | null
  venue_name: string | null; street: string | null; city: string | null; state: string | null
  ticket_mode: 'individual' | 'pacote' | 'ambos' | null; package_discount_pct: number | null
  banner_url: string | null; organization_id: string | null; capacity: number | null
  fee_mode: 'promotor' | 'comprador' | 'mista'; fee_pct: number | null
  modulo_estacionamento: boolean; parent_event_id: string | null
}

interface DiaApi {
  id: string; day_number: number; date: string; start_time: string | null; end_time: string | null
  banner_url: string | null
  event_day_attractions: { name: string; description: string | null; scheduled_time: string | null; order_index: number; image_url: string | null }[]
}
interface IngressoApi {
  id: string; name: string; price: number; quantity: number; event_day_id: string | null
  // Restante do lote em vigor agora (21/08/2026) — null = sem lote ou todos
  // esgotados/expirados, comportamento vira idêntico a antes disso existir.
  lote_ativo: { ordem: number; disponivel: number } | null
}
interface FilhoApi {
  title: string; banner_url: string | null; date_start: string | null
  ticket_mode: 'individual' | 'pacote' | 'ambos' | null; package_discount_pct: number | null
  fee_mode: 'promotor' | 'comprador' | 'mista'
  dias: DiaApi[]; ingressos: IngressoApi[]
}
interface DiasApi { dias: DiaApi[]; ingressos: IngressoApi[]; filhos: Record<string, FilhoApi> }
interface AtributosApi {
  available: { id: string; name: string; icon: string; order_index: number }[]
  values: { attribute_id: string; value_json: Record<string, string> | null }[]
}

export default async function EventoPage({ params }: Props) {
  const { id } = await params

  const coreRes = await apiFetchServer(`/api/eventos/${id}`)
  if (!coreRes.ok) notFound()
  const evento = await coreRes.json() as EventoCoreApi

  const user = await getAuthUser()
  let isOwner = false
  if (user && evento.organization_id) {
    isOwner = await isOrgAdmin(null, evento.organization_id, user.id)
  }

  // Rascunhos só são visíveis ao dono
  if (evento.status !== 'publicado' && !isOwner) notFound()

  const [paiRes, diasRes, atributosRes, vendidosRes] = await Promise.all([
    evento.parent_event_id ? apiFetchServer(`/api/eventos/${evento.parent_event_id}`) : Promise.resolve(null),
    apiFetchServer(`/api/eventos/${id}/dias`),
    apiFetchServer(`/api/eventos/${id}/atributos`),
    isOwner ? apiFetchServer(`/api/eventos/${id}/vendidos-por-ingresso`) : Promise.resolve(null),
  ])

  const paiInfo = paiRes?.ok ? await paiRes.json() as EventoCoreApi : null
  const diasData: DiasApi = diasRes.ok ? await diasRes.json() : { dias: [], ingressos: [], filhos: {} }
  const atributosData: AtributosApi = atributosRes.ok ? await atributosRes.json() : { available: [], values: [] }
  const vendidosData = vendidosRes?.ok ? await vendidosRes.json() as { soldByTicket: Record<string, number> } : null

  // Combina definição do atributo (nome/ícone) com o valor salvo pra este
  // evento — só entram os que têm valor de fato (mesmo comportamento do
  // join antigo direto na Supabase, que só trazia linhas com valor setado).
  const availableById = new Map(atributosData.available.map(a => [a.id, a]))
  const atributosAtivos = atributosData.values.flatMap(v => {
    const attr = availableById.get(v.attribute_id)
    if (!attr) return []
    return [{ id: attr.id, name: attr.name, icon: attr.icon, value_json: v.value_json }]
  })

  type AttractionRow = { name: string; description: string | null; scheduled_time: string | null; order_index: number; image_url: string | null }

  const mapDias = (lista: DiaApi[]) => lista.map(d => ({
    id:          d.id,
    dayNumber:   d.day_number,
    date:        d.date        ?? '',
    startTime:   d.start_time  ?? '',
    endTime:     d.end_time    ?? '',
    bannerUrl:   d.banner_url  ?? null,
    attractions: (d.event_day_attractions as AttractionRow[])
      .sort((a, b) => a.order_index - b.order_index)
      .map(a => ({ name: a.name, description: a.description ?? '', scheduledTime: a.scheduled_time ?? '', imageUrl: a.image_url ?? null })),
  }))

  const mapIngressos = (lista: IngressoApi[]) => lista.map(t => ({
    id:         t.id,
    name:       t.name          ?? '',
    price:      t.price         ?? 0,
    quantity:   t.quantity      ?? 0,
    eventDayId: t.event_day_id  ?? null,
    loteAtivo:  t.lote_ativo    ?? null,
  }))

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
          ticketMode:         evento.ticket_mode ?? null,
          packageDiscountPct: evento.package_discount_pct ?? 0,
          bannerUrl:          evento.banner_url         ?? null,
          moduloEstacionamento: evento.modulo_estacionamento ?? false,
          isChild:            evento.parent_event_id != null,
          parentEventId:      evento.parent_event_id ?? null,
          parentEventTitle:   paiInfo?.title ?? null,
          feeMode:            evento.fee_mode,
          feePct:             evento.fee_pct ?? 10,
        }}
        dias={mapDias(diasData.dias)}
        ingressos={mapIngressos(diasData.ingressos)}
        isOwner={isOwner}
        capacity={evento.capacity ?? null}
        soldByTicket={vendidosData?.soldByTicket ?? {}}
        atributosAtivos={atributosAtivos}
        atracoes={Object.entries(diasData.filhos).map(([filhoId, f]) => ({
          id:                 filhoId,
          title:              f.title      ?? 'Atração',
          bannerUrl:          f.banner_url ?? null,
          dateStart:          f.date_start ?? null,
          ticketMode:         f.ticket_mode ?? null,
          packageDiscountPct: f.package_discount_pct ?? 0,
          feeMode:            f.fee_mode ?? 'promotor',
          dias:               mapDias(f.dias),
          ingressos:          mapIngressos(f.ingressos),
        }))}
      />
    </div>
  )
}
