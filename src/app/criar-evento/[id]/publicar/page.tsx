import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { PublicarClient } from './PublicarClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PublicarPage({ params }: Props) {
  const { id }   = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/criar-evento')

  const { data: evento } = await supabase
    .from('events')
    .select(`
      id, title, description, category, status,
      date_start, date_end,
      venue_name, city, state, street,
      ticket_mode, package_discount_pct,
      banner_url,
      organizations(owner_id)
    `)
    .eq('id', id)
    .single()

  if (!evento) notFound()

  const org = Array.isArray(evento.organizations)
    ? evento.organizations[0]
    : evento.organizations as { owner_id: string } | null
  if (!org || (org as { owner_id: string }).owner_id !== user.id) notFound()

  // Busca dias e ingressos para o resumo
  const { data: dias } = await supabase
    .from('event_days')
    .select('id, day_number, date, start_time, end_time, event_day_attractions(name)')
    .eq('event_id', id)
    .order('day_number')

  const { data: ingressos } = await supabase
    .from('event_tickets')
    .select('id, name, price, quantity, event_day_id')
    .eq('event_id', id)
    .order('order_index')

  // Calcula número de dias
  const calcDias = () => {
    if (!evento.date_start) return 1
    const inicio = new Date(evento.date_start)
    const fim    = evento.date_end ? new Date(evento.date_end) : inicio
    return Math.max(1, Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  }

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
          <a href={`/criar-evento/${id}/ingressos`}
            className="flex items-center gap-1.5 text-[#555] hover:text-white text-xs transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <span className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-500 text-[10px]">✓</span>
            Ingressos
          </a>
          <div className="h-px flex-1 bg-[#1a1a1a]" />
          <a href={`/criar-evento/${id}/imagens`}
            className="flex items-center gap-1.5 text-[#555] hover:text-white text-xs transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <span className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-500 text-[10px]">✓</span>
            Imagens
          </a>
          <div className="h-px flex-1 bg-[#1a1a1a]" />
          <div className="flex items-center gap-1.5 text-white text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <span className="w-5 h-5 rounded-full bg-[#E8B84B] flex items-center justify-center text-[#070707] text-[10px] font-bold">4</span>
            Publicar
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl text-white mb-1"
              style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
            Publicar evento
          </h1>
          <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Revise o resumo e publique quando estiver pronto.
          </p>
        </div>

        <PublicarClient
          eventoId={id}
          statusAtual={evento.status as 'rascunho' | 'publicado' | 'cancelado'}
          resumo={{
            titulo:      evento.title       ?? '',
            descricao:   evento.description ?? '',
            categoria:   evento.category    ?? '',
            dateStart:   evento.date_start  ?? '',
            dateEnd:     evento.date_end    ?? '',
            numDias:     calcDias(),
            nomeLocal:   evento.venue_name  ?? '',
            cidade:      evento.city        ?? '',
            estado:      evento.state       ?? '',
            rua:         evento.street      ?? '',
            ticketMode:  (evento.ticket_mode ?? null) as 'individual' | 'pacote' | 'ambos' | null,
            packageDiscount: evento.package_discount_pct ?? 0,
            bannerUrl:   evento.banner_url ?? null,
          }}
          dias={(dias ?? []).map(d => ({
            day_number:  d.day_number,
            date:        d.date,
            start_time:  d.start_time ?? '',
            end_time:    d.end_time   ?? '',
            attractions: (d.event_day_attractions ?? []).map((a: { name: string }) => a.name),
          }))}
          ingressos={(ingressos ?? []).map(t => ({
            name:         t.name,
            price:        t.price,
            quantity:     t.quantity,
            event_day_id: t.event_day_id ?? null,
          }))}
        />

      </main>
    </div>
  )
}
