'use client'

// Seção de busca + filtros + grade de eventos — substituí o EventGrid server component
// Busca client-side via /api/eventos/buscar com debounce no texto e filtro imediato na categoria
import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, MapPin, Calendar, ImageIcon, Loader2, ArrowRight } from 'lucide-react'
import { useLocation } from '@/contexts/LocationContext'

// ── Tipos ──────────────────────────────────────────────────────────────────

interface EventoItem {
  id:         string
  title:      string
  date_start: string
  city:       string
  state:      string
  banner_url: string | null
  category:   string | null
  minPrice:   number | null
}

// ── Constantes ──────────────────────────────────────────────────────────────

const CATEGORIAS = [
  { label: 'Todos',       emoji: '✨', value: ''            },
  { label: 'Show',        emoji: '🎤', value: 'Show'        },
  { label: 'Festa',       emoji: '🎉', value: 'Festa'       },
  { label: 'Festival',    emoji: '🎪', value: 'Festival'    },
  { label: 'Teatro',      emoji: '🎭', value: 'Teatro'      },
  { label: 'Esporte',     emoji: '🏆', value: 'Esporte'     },
  { label: 'Gastronomia', emoji: '🍽️', value: 'Gastronomia' },
  { label: 'Arte',        emoji: '🎨', value: 'Arte'        },
  { label: 'Tecnologia',  emoji: '💻', value: 'Tecnologia'  },
  { label: 'Religioso',   emoji: '🙏', value: 'Religioso'   },
  { label: 'Outro',       emoji: '🔖', value: 'Outro'       },
]

const ACCENT_COLORS = ['#a855f7','#f97316','#E8B84B','#ec4899','#22c55e','#06b6d4','#eab308']

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).replace('.', '')
}

function formatPrice(min: number | null) {
  if (min === null) return 'Ver preços'
  if (min === 0)    return 'Gratuito'
  return `A partir de R$ ${min.toFixed(2).replace('.', ',')}`
}

// ── Card de evento ───────────────────────────────────────────────────────────

function EventCard({ evento, color }: { evento: EventoItem; color: string }) {
  const gratuito = evento.minPrice === 0
  const semPreco = evento.minPrice === null

  return (
    <a
      href={`/evento/${evento.id}`}
      className="group t7-event-card block"
    >
      {/* Thumbnail */}
      <div
        className="relative w-full aspect-video flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, var(--bg-raised) 0%, ${color}15 100%)` }}
      >
        {evento.banner_url
          ? <img src={evento.banner_url} alt={evento.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
          : <ImageIcon size={28} style={{ color: `${color}50` }} />
        }

        {/* Linha colorida na base */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px]"
             style={{ background: `linear-gradient(90deg, transparent, ${color}70, transparent)` }} />

        {/* Overlay hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-all duration-200" />

        {/* Badge de categoria */}
        {evento.category && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide"
              style={{
                background:  `${color}20`,
                color,
                border:      `1px solid ${color}40`,
                fontFamily:  'var(--font-dm-sans)',
              }}>
              {evento.category}
            </span>
          </div>
        )}
      </div>

      {/* Informações */}
      <div className="p-4 flex flex-col gap-3">
        <h3
          className="text-sm font-medium leading-snug line-clamp-2 transition-colors duration-200"
          style={{ fontFamily: 'var(--font-outfit)', color: 'var(--text-1)' }}>
          {evento.title}
        </h3>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] flex-1 min-w-0"
                style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text-3)' }}>
            <Calendar size={10} className="shrink-0" />
            {formatDate(evento.date_start)}
          </span>
          <span className="flex items-center gap-1 text-[11px] flex-1 min-w-0 truncate"
                style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text-3)' }}>
            <MapPin size={10} className="shrink-0" />
            {evento.city}
          </span>
        </div>

        {/* Preço */}
        <div
          className="w-full py-2 rounded-xl text-center text-xs font-semibold"
          style={{
            background: gratuito ? 'rgba(34,197,94,0.08)' : semPreco ? 'var(--bg-raised)' : `${color}10`,
            border:     gratuito ? '1px solid rgba(34,197,94,0.20)' : semPreco ? '1px solid var(--border-light)' : `1px solid ${color}30`,
            color:      gratuito ? '#16a34a' : semPreco ? 'var(--text-3)' : color,
            fontFamily: 'var(--font-dm-sans)',
          }}>
          {formatPrice(evento.minPrice)}
        </div>
      </div>
    </a>
  )
}

// ── Skeleton de loading ──────────────────────────────────────────────────────

function CardSkeleton({ i }: { i: number }) {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse"
         style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', animationDelay: `${i * 80}ms` }}>
      <div className="w-full aspect-video" style={{ background: 'var(--bg-raised)' }} />
      <div className="p-4 flex flex-col gap-3">
        <div className="h-4 rounded-lg w-3/4" style={{ background: 'var(--border)' }} />
        <div className="flex gap-3">
          <div className="h-3 rounded-lg flex-1" style={{ background: 'var(--border-light)' }} />
          <div className="h-3 rounded-lg flex-1" style={{ background: 'var(--border-light)' }} />
        </div>
        <div className="h-8 rounded-xl" style={{ background: 'var(--bg-raised)' }} />
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────

export function SearchSection({ limit = 12 }: { limit?: number }) {
  const { city } = useLocation()
  const [q,         setQ]         = useState('')
  const [categoria, setCategoria] = useState('')
  const [eventos,   setEventos]   = useState<EventoItem[]>([])
  const [loading,   setLoading]   = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchEventos = useCallback((search: string, cat: string, cidadeAtual: string | null) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(limit) })
    if (search)       params.set('q', search)
    if (cat)          params.set('categoria', cat)
    if (cidadeAtual)  params.set('cidade', cidadeAtual)

    fetch(`/api/eventos/buscar?${params}`)
      .then(r => r.json())
      .then(data => setEventos(data.eventos ?? []))
      .catch(() => setEventos([]))
      .finally(() => setLoading(false))
  }, [])

  // Re-busca quando categoria ou cidade muda (imediato)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    fetchEventos(q, categoria, city)
  }, [categoria, city]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (value: string) => {
    setQ(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchEventos(value, categoria, city), 350)
  }

  const limparFiltros = () => {
    setQ('')
    setCategoria('')
    fetchEventos('', '', city)
  }

  const temFiltro = q || categoria

  return (
    <section className="px-4 pb-16 max-w-6xl mx-auto mt-10">

      {/* Divisor sutil */}
      <div className="t7-divider mb-10" />

      {/* Cabeçalho */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h2
            className="text-lg font-medium"
            style={{ fontFamily: 'var(--font-outfit)', color: 'var(--text-1)' }}>
            Próximos eventos
          </h2>
          <p className="text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text-2)' }}>
            {city ? `Eventos em ${city}` : 'Encontre experiências perto de você'}
          </p>
        </div>

        {temFiltro && (
          <button
            onClick={limparFiltros}
            className="t7-hover-gold flex items-center gap-1 text-xs transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text-3)' }}>
            <X size={12} />
            Limpar filtros
          </button>
        )}
      </div>

      {/* Barra de busca */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-3)' }} />
        <input
          type="text"
          value={q}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Buscar eventos por nome..."
          className="t7-input w-full pl-10 pr-10 py-3 text-sm"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        />
        {q && (
          <button
            onClick={() => { setQ(''); fetchEventos('', categoria, city) }}
            className="t7-hover-text1 absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: 'var(--text-3)' }}>
            <X size={15} />
          </button>
        )}
      </div>

      {/* Chips de categoria */}
      <div
        className="flex gap-2 pb-1 mb-7 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}>
        {CATEGORIAS.map(cat => {
          const ativo = categoria === cat.value
          return (
            <button
              key={cat.value}
              onClick={() => setCategoria(cat.value)}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
              style={{
                background:  ativo ? 'var(--gold)' : 'var(--bg-raised)',
                color:       ativo ? '#1A1714' : 'var(--text-2)',
                border:      ativo ? '1px solid var(--gold)' : '1px solid var(--border-light)',
                fontFamily:  'var(--font-dm-sans)',
              }}>
              <span>{cat.emoji}</span>
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* Grid de eventos — loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} i={i} />)}
        </div>
      )}

      {/* Grid de eventos — resultados */}
      {!loading && eventos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {eventos.map((ev, i) => (
            <EventCard
              key={ev.id}
              evento={ev}
              color={ACCENT_COLORS[i % ACCENT_COLORS.length]}
            />
          ))}
        </div>
      )}

      {/* Sem resultados */}
      {!loading && eventos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-light)' }}>
            <Search size={22} style={{ color: 'var(--text-3)' }} />
          </div>
          <div className="text-center">
            <p className="text-sm mb-1" style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text-2)' }}>
              Nenhum evento encontrado
              {q ? <span> para <em className="not-italic" style={{ color: 'var(--text-1)' }}>"{q}"</em></span> : ''}
            </p>
            {temFiltro && (
              <button
                onClick={limparFiltros}
                className="inline-flex items-center gap-1 text-xs hover:underline mt-2"
                style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--gold)' }}>
                Limpar filtros
                <ArrowRight size={11} />
              </button>
            )}
          </div>
        </div>
      )}

    </section>
  )
}
