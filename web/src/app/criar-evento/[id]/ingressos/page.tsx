import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/server'
import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { IngressosClient } from './IngressosClient'
import { isOrgAdmin } from '@/lib/orgAdmin'

interface Props {
  params: Promise<{ id: string }>
}

export default async function IngressosPage({ params }: Props) {
  const { id }   = await params
  const supabase = await createClient()

  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/criar-evento')

  const { data: evento } = await supabase
    .from('events')
    .select('id, title, date_start, date_end, venue_name, city, ticket_mode, package_discount_pct, parent_event_id, modulo_tenda, modulo_estacionamento, organization_id')
    .eq('id', id)
    .single()

  if (!evento) notFound()
  if (!(await isOrgAdmin(supabase, evento.organization_id, user.id))) notFound()

  // Se o promotor chegou direto nesta etapa (ex: atalho na lista de eventos)
  // sem ter completado Informações, o "continuar" precisa saber disso pra
  // voltar pra lá em vez de seguir adiante achando que já está tudo pronto.
  const infoCompleta = !!evento.title && !!evento.date_start && !!(evento.venue_name || evento.city)

  // Tenda/Estacionamento não geram um intervalo contínuo de dias — o promotor
  // escolhe quais dias específicos do calendário do PAI se aplicam a este filho.
  const herdaDiasDoPai = !!evento.parent_event_id && (!!evento.modulo_tenda || !!evento.modulo_estacionamento)
  let diasHerdaveis: { id: string | null; day_number: number; date: string; start_time: string; end_time: string }[] = []
  if (herdaDiasDoPai) {
    const { data: diasPai } = await supabase
      .from('event_days')
      .select('id, day_number, date, start_time, end_time')
      .eq('event_id', evento.parent_event_id!)
      .order('day_number')

    if (diasPai?.length) {
      diasHerdaveis = diasPai.map(d => ({
        id:         d.id,
        day_number: d.day_number,
        date:       d.date,
        start_time: d.start_time ?? '',
        end_time:   d.end_time   ?? '',
      }))
    } else {
      // Pai ainda não passou pela própria etapa de ingressos (sem event_days
      // salvos) — gera as opções a partir do intervalo date_start/date_end dele.
      const { data: pai } = await supabase
        .from('events')
        .select('date_start, date_end')
        .eq('id', evento.parent_event_id!)
        .single()
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

  // Busca dias já configurados
  const { data: dias } = await supabase
    .from('event_days')
    .select('id, day_number, date, start_time, end_time, banner_url, event_day_attractions(id, name, description, order_index, scheduled_time, image_url)')
    .eq('event_id', id)
    .order('day_number')

  // Busca ingressos já cadastrados
  const { data: ingressos } = await supabase
    .from('event_tickets')
    .select('id, event_day_id, name, description, price, quantity, order_index')
    .eq('event_id', id)
    .order('order_index')

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
          ticketModeInicial={(evento.ticket_mode ?? null) as 'individual' | 'pacote' | 'ambos' | null}
          packageDiscountInicial={evento.package_discount_pct ?? 0}
          diasIniciais={(dias ?? []).map(d => ({
            id:          d.id,
            day_number:  d.day_number,
            date:        d.date,
            start_time:  d.start_time ?? '',
            end_time:    d.end_time   ?? '',
            banner_url:  d.banner_url ?? null,
            attractions: (d.event_day_attractions ?? []).map((a: { id: string; name: string; description: string | null; order_index: number; scheduled_time: string | null; image_url: string | null }) => ({
              id:             a.id,
              name:           a.name,
              description:    a.description ?? '',
              order_index:    a.order_index,
              scheduled_time: a.scheduled_time ?? '',
              image_url:      a.image_url ?? null,
            })),
          }))}
          ingressosIniciais={(ingressos ?? []).map(t => ({
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
