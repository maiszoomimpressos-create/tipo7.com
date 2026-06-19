import { createClient } from '@/lib/supabase/server'
import { MapPin, Calendar, ImageIcon } from 'lucide-react'

const ACCENT_COLORS = ['#a855f7','#f97316','#E8B84B','#ec4899','#22c55e','#06b6d4','#eab308']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).replace('.', '')
}

function formatPrice(min: number | null) {
  if (min === null)  return 'Ver preços'
  if (min === 0)     return 'Gratuito'
  return `A partir de R$ ${min.toFixed(2).replace('.', ',')}`
}

interface EventoItem {
  id:         string
  title:      string
  date_start: string
  city:       string
  state:      string
  banner_url: string | null
  minPrice:   number | null
}

// ─── Card individual ──────────────────────────────────────────────────────────

function EventCard({ evento, color }: { evento: EventoItem; color: string }) {
  const gratuito = evento.minPrice === 0
  const semPreco = evento.minPrice === null

  return (
    <a
      href={`/evento/${evento.id}`}
      className="group relative bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden hover:border-[#2a2a2a] transition-all duration-200"
    >
      {/* Thumbnail 16:9 */}
      <div
        className="relative w-full aspect-video flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, #0d0d0d 0%, ${color}18 100%)` }}
      >
        {evento.banner_url
          ? <img src={evento.banner_url} alt={evento.title} className="w-full h-full object-cover" />
          : <ImageIcon size={28} style={{ color: `${color}30` }} />
        }
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, transparent, ${color}80, transparent)` }}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-all duration-200" />
      </div>

      {/* Informações */}
      <div className="p-4 flex flex-col gap-3">
        <h3
          className="text-white text-sm font-medium leading-snug line-clamp-2 group-hover:text-[#E8B84B] transition-colors duration-200"
          style={{ fontFamily: 'var(--font-outfit)' }}>
          {evento.title}
        </h3>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[#555] text-[11px] flex-1 min-w-0"
                style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <Calendar size={10} className="shrink-0" />
            {formatDate(evento.date_start)}
          </span>
          <span className="flex items-center gap-1 text-[#555] text-[11px] flex-1 min-w-0 truncate"
                style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <MapPin size={10} className="shrink-0" />
            {evento.city}
          </span>
        </div>

        {/* Preço */}
        <div
          className="w-full py-2 rounded-xl text-center text-xs font-semibold"
          style={{
            background: gratuito ? 'rgba(34,197,94,0.08)'   : semPreco ? 'rgba(255,255,255,0.03)' : `${color}10`,
            border:     gratuito ? '1px solid rgba(34,197,94,0.20)' : semPreco ? '1px solid rgba(255,255,255,0.06)' : `1px solid ${color}30`,
            color:      gratuito ? '#4ade80'                : semPreco ? '#444'                   : color,
            fontFamily: 'var(--font-dm-sans)',
          }}>
          {formatPrice(evento.minPrice)}
        </div>
      </div>
    </a>
  )
}

// ─── Grid principal (server component) ───────────────────────────────────────

export async function EventGrid() {
  const supabase = await createClient()

  // Eventos publicados futuros — até 6
  const { data: eventos } = await supabase
    .from('events')
    .select('id, title, date_start, city, state, banner_url')
    .eq('status', 'publicado')
    .gte('date_start', new Date().toISOString())
    .order('date_start', { ascending: true })
    .limit(6)

  if (!eventos || eventos.length === 0) return null

  // Preço mínimo por evento (uma query só para todos os ids)
  const ids = eventos.map(e => e.id)
  const { data: tickets } = await supabase
    .from('event_tickets')
    .select('event_id, price')
    .in('event_id', ids)

  const minPrices: Record<string, number | null> = Object.fromEntries(ids.map(id => [id, null]))
  tickets?.forEach(t => {
    const atual = minPrices[t.event_id]
    if (atual === null || t.price < atual) minPrices[t.event_id] = t.price
  })

  return (
    <section className="px-4 pb-16 max-w-6xl mx-auto mt-10">

      {/* Divisor sutil */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#1e1e1e] to-transparent mb-10" />

      {/* Cabeçalho */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-medium"
              style={{ fontFamily: 'var(--font-outfit)' }}>
            Próximos eventos
          </h2>
          <p className="text-[#444] text-xs mt-0.5"
             style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Encontre experiências perto de você
          </p>
        </div>
        <a href="#"
          className="text-[#555] text-xs hover:text-[#E8B84B] transition-colors"
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Ver todos →
        </a>
      </div>

      {/* Grade */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {eventos.map((ev, i) => (
          <EventCard
            key={ev.id}
            evento={{ ...ev, minPrice: minPrices[ev.id] ?? null }}
            color={ACCENT_COLORS[i % ACCENT_COLORS.length]}
          />
        ))}
      </div>

    </section>
  )
}
