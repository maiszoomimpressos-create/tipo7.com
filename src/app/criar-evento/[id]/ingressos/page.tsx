import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { IngressosClient } from './IngressosClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function IngressosPage({ params }: Props) {
  const { id }   = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/criar-evento')

  const { data: evento } = await supabase
    .from('events')
    .select('id, title, date_start, date_end, ticket_mode, package_discount_pct, organizations(owner_id)')
    .eq('id', id)
    .single()

  if (!evento) notFound()

  const org = Array.isArray(evento.organizations)
    ? evento.organizations[0]
    : evento.organizations as { owner_id: string } | null
  if (!org || (org as { owner_id: string }).owner_id !== user.id) notFound()

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
    .select('id, day_number, date, start_time, end_time, event_day_attractions(id, name, description, order_index, scheduled_time)')
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

        {/* Indicador de etapas */}
        <div className="flex items-center gap-2 mb-8">
          <a href={`/criar-evento/${id}`}
            className="flex items-center gap-1.5 text-[#555] hover:text-white text-xs transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <span className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-500 text-[10px]">✓</span>
            Informações
          </a>
          <div className="h-px flex-1 bg-[#1a1a1a]" />
          <div className="flex items-center gap-1.5 text-white text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <span className="w-5 h-5 rounded-full bg-[#E8B84B] flex items-center justify-center text-[#070707] text-[10px] font-bold">2</span>
            Ingressos
          </div>
          <div className="h-px flex-1 bg-[#1a1a1a]" />
          <div className="flex items-center gap-1.5 text-[#333] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <span className="w-5 h-5 rounded-full bg-[#111] border border-[#222] flex items-center justify-center text-[10px]">3</span>
            Imagens
          </div>
          <div className="h-px flex-1 bg-[#1a1a1a]" />
          <div className="flex items-center gap-1.5 text-[#333] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <span className="w-5 h-5 rounded-full bg-[#111] border border-[#222] flex items-center justify-center text-[10px]">4</span>
            Publicar
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl text-white mb-1"
              style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
            {evento.title}
          </h1>
          <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Configure os ingressos{numDias > 1 ? ` para os ${numDias} dias do evento` : ' do evento'}.
          </p>
        </div>

        <IngressosClient
          eventoId={id}
          numDias={numDias}
          dateStart={evento.date_start ?? ''}
          ticketModeInicial={(evento.ticket_mode ?? null) as 'individual' | 'pacote' | 'ambos' | null}
          packageDiscountInicial={evento.package_discount_pct ?? 0}
          diasIniciais={(dias ?? []).map(d => ({
            id:          d.id,
            day_number:  d.day_number,
            date:        d.date,
            start_time:  d.start_time ?? '',
            end_time:    d.end_time   ?? '',
            attractions: (d.event_day_attractions ?? []).map((a: { id: string; name: string; description: string | null; order_index: number; scheduled_time: string | null }) => ({
              id:             a.id,
              name:           a.name,
              description:    a.description ?? '',
              order_index:    a.order_index,
              scheduled_time: a.scheduled_time ?? '',
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
