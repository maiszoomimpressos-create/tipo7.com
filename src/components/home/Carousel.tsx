'use client'

// Carrossel da landing page — estilo Sympla
// Banner central em destaque + cards verticais estreitos nas laterais
// Busca eventos reais do banco filtrados pela cidade do usuário
import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, MapPin, Calendar, ArrowRight, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useWindowSize } from '@/hooks/useWindowSize'
import { useLocation } from '@/contexts/LocationContext'

// Tipo do evento retornado pela API
interface Evento {
  id:          string
  title:       string
  description: string | null
  date_start:  string
  city:        string
  state:       string
  cover_url:   string | null
}

// Cores de acento por índice — usadas quando o evento não tem cor definida
const ACCENT_COLORS = ['#a855f7','#f97316','#E8B84B','#ec4899','#22c55e','#06b6d4','#eab308']

// Formata data ISO para exibição: "28 Dez 2026"
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).replace('.', '')
}

// Configuração do carrossel por breakpoint
// Adapta altura, largura e quantidade de cards laterais para cada tamanho de tela
const getCarouselConfig = (width: number) => {
  if (width < 640) {
    // Mobile — banner quase full width, 1 card de cada lado
    return {
      height:      280,
      centerWidth: Math.min(width * 0.82, 380),
      maxSides:    1,
      sideConfig: [
        { width: 48, gap: 3, opacity: 0.75, scale: 0.85 },
      ],
    }
  }
  if (width < 1024) {
    // Tablet — 2 cards de cada lado
    return {
      height:      360,
      centerWidth: Math.min(width * 0.62, 580),
      maxSides:    2,
      sideConfig: [
        { width: 105, gap: 5, opacity: 0.85, scale: 0.85 },
        { width:  85, gap: 3, opacity: 0.50, scale: 0.72 },
      ],
    }
  }
  // Desktop — 3 cards de cada lado
  return {
    height:      420,
    centerWidth: 780,
    maxSides:    3,
    sideConfig: [
      { width: 175, gap: 1, opacity: 0.90, scale: 0.85 },
      { width: 155, gap: 1, opacity: 0.65, scale: 0.72 },
      { width: 135, gap: 1, opacity: 0.38, scale: 0.61 },
    ],
  }
}

export function Carousel() {
  const [current,  setCurrent]  = useState(0)
  const [paused,   setPaused]   = useState(false)
  const [eventos,  setEventos]  = useState<Evento[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filtrado, setFiltrado] = useState(false)
  const touchStartX             = useRef<number | null>(null)

  const { width } = useWindowSize()
  const { city }  = useLocation()
  const config    = getCarouselConfig(width)

  // Busca eventos do banco sempre que a cidade mudar
  useEffect(() => {
    setLoading(true)
    setCurrent(0)
    const params = city ? `?cidade=${encodeURIComponent(city)}` : ''
    fetch(`/api/eventos/destaque${params}`)
      .then(r => r.json())
      .then(data => {
        setEventos(data.eventos ?? [])
        setFiltrado(data.filtrado ?? false)
      })
      .finally(() => setLoading(false))
  }, [city])

  const next = useCallback(() => setCurrent(p => (p + 1) % Math.max(eventos.length, 1)), [eventos.length])
  const prev = useCallback(() => setCurrent(p => (p - 1 + Math.max(eventos.length, 1)) % Math.max(eventos.length, 1)), [eventos.length])

  // Auto-avanço a cada 5 segundos
  useEffect(() => {
    if (paused) return
    const t = setInterval(next, 5000)
    return () => clearInterval(t)
  }, [paused, next])

  // Swipe para mobile — detecta arrasto horizontal e navega
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) {
      diff > 0 ? next() : prev()
    }
    touchStartX.current = null
  }

  // Posição relativa de cada item em relação ao banner central
  const getRelPos = (index: number) => {
    const total = eventos.length
    let pos = index - current
    if (pos >  total / 2) pos -= total
    if (pos < -total / 2) pos += total
    return pos
  }

  // Calcula o deslocamento horizontal (em px) de um card lateral
  // Usa a largura VISUAL (após scale) para não criar falha entre os banners
  const getSideTranslateX = (relPos: number): number => {
    const absPos = Math.abs(relPos)
    if (absPos === 0 || absPos > config.maxSides) return 0

    const GAP = 1

    let x = config.centerWidth / 2
    for (let i = 0; i < absPos; i++) {
      const cfg             = config.sideConfig[i]
      const visualHalfWidth = (cfg.width * cfg.scale) / 2
      x += GAP + visualHalfWidth
      if (i < absPos - 1) x += visualHalfWidth
    }

    return relPos > 0 ? x : -x
  }

  const activeEvento = eventos[current]

  return (
    <section
      className="w-full py-6 px-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Título da seção com cidade detectada */}
      <p
        className="text-center text-[#555555] text-xs tracking-widest uppercase mb-4"
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      >
        {filtrado && city ? `Eventos em destaque em ${city}` : 'Eventos em destaque'}
      </p>

      {/* ─── Loading ──────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center" style={{ height: config.height }}>
          <Loader2 size={28} className="text-[#E8B84B] animate-spin" />
        </div>
      )}

      {/* ─── Área do carrossel ────────────────────────────────── */}
      {!loading && eventos.length > 0 && (
      <div
        className="relative flex items-center justify-center mx-auto overflow-visible"
        style={{ height: config.height, maxWidth: '100%' }}
      >
        {eventos.map((evento, index) => {
          const relPos   = getRelPos(index)
          const absPos   = Math.abs(relPos)
          const isCenter = relPos === 0
          const accent   = ACCENT_COLORS[index % ACCENT_COLORS.length]
          const imgSrc   = evento.cover_url ?? `https://picsum.photos/seed/${evento.id}/780/420`

          if (absPos > config.maxSides) return null

          // ── Banner central ──────────────────────────────────
          if (isCenter) {
            return (
              <a
                key={evento.id}
                href={`/evento/${evento.id}`}
                className="absolute rounded-2xl overflow-hidden transition-all duration-500 cursor-pointer"
                style={{
                  width:   config.centerWidth,
                  height:  config.height,
                  zIndex:  20,
                  left:    '50%',
                  transform: 'translateX(-50%)',
                }}
              >
                {/* Imagem de fundo do banner */}
                <Image
                  src={imgSrc}
                  alt={evento.title}
                  fill
                  className="object-cover"
                  sizes="780px"
                  priority={index === 0}
                  unoptimized
                />

                {/* Overlay escuro para o texto ficar legível sobre a imagem */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

                {/* Cidade do evento */}
                <div className="absolute top-6 left-6 z-10">
                  <span
                    className="px-3 py-1 rounded-full text-[11px] font-semibold tracking-widest uppercase"
                    style={{
                      background: `${accent}25`,
                      color:      accent,
                      border:     `1px solid ${accent}40`,
                      fontFamily: 'var(--font-dm-sans)',
                    }}
                  >
                    {evento.city} · {evento.state}
                  </span>
                </div>

                {/* Linha de cor na base */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
                />

                {/* Seta esquerda — sobre o banner */}
                <button
                  onClick={(e) => { e.stopPropagation(); prev() }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 border border-white/15 text-white hover:bg-black/50 transition-all duration-200 backdrop-blur-sm"
                  aria-label="Banner anterior"
                >
                  <ChevronLeft size={20} />
                </button>

                {/* Seta direita — sobre o banner */}
                <button
                  onClick={(e) => { e.stopPropagation(); next() }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 border border-white/15 text-white hover:bg-black/50 transition-all duration-200 backdrop-blur-sm"
                  aria-label="Próximo banner"
                >
                  <ChevronRight size={20} />
                </button>
              </a>
            )
          }

          // ── Cards laterais ──────────────────────────────────
          const sideConfig = config.sideConfig[absPos - 1]
          const translateX = getSideTranslateX(relPos)

          return (
            <div
              key={evento.id}
              onClick={() => { setCurrent(index); setPaused(true); setTimeout(() => setPaused(false), 3000) }}
              className="absolute rounded-xl overflow-hidden cursor-pointer transition-all duration-500"
              style={{
                width:     sideConfig.width,
                height:    config.height,
                opacity:   sideConfig.opacity,
                zIndex:    20 - absPos * 3,
                left:      '50%',
                transform: `translateX(calc(-50% + ${translateX}px)) scale(${sideConfig.scale})`,
              }}
            >
              {/* Imagem de fundo do card lateral */}
              <Image
                src={imgSrc}
                alt={evento.title}
                fill
                className="object-cover"
                sizes="175px"
                unoptimized
              />

              {/* Sombra interna na borda que encosta no banner central — dá profundidade */}
              <div
                className="absolute inset-0 z-10"
                style={{
                  background: relPos > 0
                    ? 'linear-gradient(to right, rgba(0,0,0,0.75) 0%, transparent 60%)'
                    : 'linear-gradient(to left,  rgba(0,0,0,0.75) 0%, transparent 60%)',
                }}
              />
            </div>
          )
        })}
      </div>
      )}

      {/* ─── Informações do evento ativo (abaixo do banner) ─── */}
      {!loading && activeEvento && (
      <div className="mt-5 flex flex-col items-center gap-3 text-center transition-all duration-300">

        {/* Título do evento */}
        <h2
          className="text-white text-xl md:text-2xl leading-tight tracking-wide"
          style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}
        >
          {activeEvento.title}
        </h2>

        {/* Data, local e botão — todos na mesma linha */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <span className="flex items-center gap-1.5 text-[#888] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <MapPin size={13} style={{ color: ACCENT_COLORS[current % ACCENT_COLORS.length] }} />
            {activeEvento.city} · {activeEvento.state}
          </span>
          <span className="flex items-center gap-1.5 text-[#888] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <Calendar size={13} style={{ color: ACCENT_COLORS[current % ACCENT_COLORS.length] }} />
            {formatDate(activeEvento.date_start)}
          </span>
          <a
            href={`/evento/${activeEvento.id}`}
            className="group flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[#070707] font-semibold text-sm transition-all duration-200"
            style={{ background: ACCENT_COLORS[current % ACCENT_COLORS.length], fontFamily: 'var(--font-dm-sans)' }}
          >
            Ver ingressos
            <ArrowRight size={13} strokeWidth={2.5} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
        </div>

        {/* Bolinhas indicadoras */}
        <div className="flex items-center gap-2 mt-1">
          {eventos.map((_, index) => (
            <button
              key={index}
              onClick={() => { setCurrent(index); setPaused(true); setTimeout(() => setPaused(false), 3000) }}
              className="rounded-full transition-all duration-300"
              style={{
                width:      current === index ? '22px' : '6px',
                height:     '6px',
                background: current === index
                  ? ACCENT_COLORS[current % ACCENT_COLORS.length]
                  : 'rgba(255,255,255,0.2)',
              }}
              aria-label={`Ir para banner ${index + 1}`}
            />
          ))}
        </div>
      </div>
      )}
    </section>
  )
}
