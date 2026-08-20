import { apiFetchServer } from '@/lib/apiFetchServer'
import { notFound } from 'next/navigation'
import { PainelIngressosClient } from './PainelIngressosClient'

interface Props {
  params: Promise<{ id: string }>
}

interface EventoCoreApi {
  capacity: number | null
}
interface DiaApi { id: string; day_number: number; date: string; start_time: string | null; end_time: string | null }
interface IngressoApi { id: string; name: string; price: number; quantity: number; event_day_id: string | null }
interface DiasApi { dias: DiaApi[]; ingressos: IngressoApi[] }

// Mesma lógica de fetch de web/src/app/evento/[id]/page.tsx, escopada só
// pro que PainelIngressos precisa — sem o resto da vitrine pública (banner,
// atributos, filhos/atrações etc.) que não faz sentido aqui.
export default async function GerenciarIngressosPage({ params }: Props) {
  const { id } = await params

  const [coreRes, diasRes, vendidosRes] = await Promise.all([
    apiFetchServer(`/api/eventos/${id}`),
    apiFetchServer(`/api/eventos/${id}/dias`),
    apiFetchServer(`/api/eventos/${id}/vendidos-por-ingresso`),
  ])
  if (!coreRes.ok) notFound()

  const core = await coreRes.json() as EventoCoreApi
  const diasData: DiasApi = diasRes.ok ? await diasRes.json() : { dias: [], ingressos: [] }
  const vendidosData = vendidosRes.ok ? await vendidosRes.json() as { soldByTicket: Record<string, number> } : { soldByTicket: {} }

  const dias = diasData.dias.map(d => ({
    id: d.id, dayNumber: d.day_number, date: d.date ?? '', startTime: d.start_time ?? '', endTime: d.end_time ?? '',
  }))

  const ingressos = diasData.ingressos.map(t => ({
    id:         t.id,
    name:       t.name ?? '',
    price:      t.price ?? 0,
    quantity:   t.quantity ?? 0,
    sold:       vendidosData.soldByTicket[t.id] ?? 0,
    eventDayId: t.event_day_id ?? null,
  }))

  return (
    <PainelIngressosClient
      eventoId={id}
      ingressos={ingressos}
      capacity={core.capacity ?? null}
      dias={dias}
      diaSelecionadoId={dias[0]?.id ?? null}
    />
  )
}
