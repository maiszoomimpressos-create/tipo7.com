import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { IngressosClient } from './IngressosClient'
import { isOrgAdmin } from '@/lib/orgAdmin'

interface Props {
  params: Promise<{ id: string }>
}

interface EventoApi {
  id: string; title: string | null; date_start: string | null; date_end: string | null
  venue_name: string | null; city: string | null
  ticket_mode: 'individual' | 'pacote' | 'ambos' | null; package_discount_pct: number | null
  parent_event_id: string | null; modulo_tenda: boolean; modulo_estacionamento: boolean
  organization_id: string
}

interface DiasApi {
  dias: Array<{
    id: string; day_number: number; date: string; start_time: string | null; end_time: string | null
    banner_url: string | null
    event_day_attractions: Array<{ id: string; name: string; description: string | null; order_index: number; scheduled_time: string | null; image_url: string | null }>
  }>
  ingressos: Array<{ id: string; event_day_id: string | null; name: string; description: string | null; price: number; quantity: number; order_index: number }>
}

export default async function IngressosPage({ params }: Props) {
  const { id } = await params

  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/criar-evento')

  const eventoRes = await apiFetchServer(`/api/eventos/${id}`)
  if (eventoRes.status === 404) notFound()
  const evento: EventoApi = await eventoRes.json()

  if (!evento) notFound()
  if (!(await isOrgAdmin(null, evento.organization_id, user.id))) notFound()

  // Se o promotor chegou direto nesta etapa (ex: atalho na lista de eventos)
  // sem ter completado Informações, o "continuar" precisa saber disso pra
  // voltar pra lá em vez de seguir adiante achando que já está tudo pronto.
  const infoCompleta = !!evento.title && !!evento.date_start && !!(evento.venue_name || evento.city)

  // Tenda/Estacionamento não geram um intervalo contínuo de dias — o promotor
  // escolhe quais dias específicos do calendário do PAI se aplicam a este filho.
  const herdaDiasDoPai = !!evento.parent_event_id && (!!evento.modulo_tenda || !!evento.modulo_estacionamento)
  let diasHerdaveis: { id: string | null; day_number: number; date: string; start_time: string; end_time: string }[] = []
  if (herdaDiasDoPai) {
    const diasPaiRes = await apiFetchServer(`/api/eventos/${evento.parent_event_id}/dias`)
    const diasPaiData: DiasApi = diasPaiRes.ok ? await diasPaiRes.json() : { dias: [], ingressos: [] }

    if (diasPaiData.dias?.length) {
      diasHerdaveis = diasPaiData.dias.map(d => ({
        id:         d.id,
        day_number: d.day_number,
        date:       d.date,
        start_time: d.start_time ?? '',
        end_time:   d.end_time   ?? '',
      }))
    } else {
      // Pai ainda não passou pela própria etapa de ingressos (sem event_days
      // salvos) — gera as opções a partir do intervalo date_start/date_end dele.
      const paiRes = await apiFetchServer(`/api/eventos/${evento.parent_event_id}`)
      const pai = paiRes.ok ? await paiRes.json() as { date_start: string | null; date_end: string | null } : null
      if (pai?.date_start) {
        const inicio = new Date(pai.date_start)
        const fim    = pai.date_end ? new Date(pai.date_end) : inicio
        const numDiasPai = Math.max(1, Math.floor((fim.getTime() - inicio.getTime()) / 86400000) + 1)
        const hora = (d: Date) => `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`
        for (let i = 0; i < numDiasPai; i++) {
          const d = new Date(inicio)
          d.setUTCDate(d.getUTCDate() + i)
          diasHerdaveis.push({
            id:         null,
            day_number: i + 1,
            date:       d.toISOString().slice(0, 10),
            start_time: hora(inicio),
            end_time:   hora(fim),
          })
        }
      }
    }
  }

  // Calcula número de dias entre date_start e date_end
  const calcDias = () => {
    if (!evento.date_start) return 1
    const inicio = new Date(evento.date_start)
    const fim    = evento.date_end ? new Date(evento.date_end) : inicio
    const diff   = Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(1, diff + 1)
  }
  const numDias = calcDias()

  // Busca dias e ingressos já configurados
  const diasRes = await apiFetchServer(`/api/eventos/${id}/dias`)
  const { dias, ingressos }: DiasApi = diasRes.ok
    ? await diasRes.json()
    : { dias: [], ingressos: [] }

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-12">


        <div className="mb-8">
          <h1 className="text-2xl text-white mb-1"
              style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
            {evento.title}
          </h1>
          <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {herdaDiasDoPai
              ? 'Escolha em quais dias do evento principal este evento acontece, e configure os ingressos.'
              : `Configure os ingressos${numDias > 1 ? ` para os ${numDias} dias do evento` : ' do evento'}.`}
          </p>
        </div>

        <IngressosClient
          eventoId={id}
          infoCompleta={infoCompleta}
          numDias={numDias}
          dateStart={evento.date_start ?? ''}
          dateEnd={evento.date_end ?? ''}
          diasHerdaveis={herdaDiasDoPai ? diasHerdaveis : undefined}
          ticketModeInicial={evento.ticket_mode ?? null}
          packageDiscountInicial={evento.package_discount_pct ?? 0}
          diasIniciais={dias.map(d => ({
            id:          d.id,
            day_number:  d.day_number,
            date:        d.date,
            start_time:  d.start_time ?? '',
            end_time:    d.end_time   ?? '',
            banner_url:  d.banner_url ?? null,
            attractions: (d.event_day_attractions ?? []).map(a => ({
              id:             a.id,
              name:           a.name,
              description:    a.description ?? '',
              order_index:    a.order_index,
              scheduled_time: a.scheduled_time ?? '',
              image_url:      a.image_url ?? null,
            })),
          }))}
          ingressosIniciais={ingressos.map(t => ({
            id:           t.id,
            event_day_id: t.event_day_id ?? null,
            name:         t.name,
            description:  t.description ?? '',
            price:        t.price,
            quantity:     t.quantity,
            order_index:  t.order_index,
          }))}
        />

      </main>
    </div>
  )
}
