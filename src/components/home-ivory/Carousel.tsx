'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ChevronLeft, ChevronRight, MapPin, Calendar, ArrowRight, Loader2, Megaphone } from 'lucide-react'
import Image from 'next/image'
import { useWindowSize } from '@/hooks/useWindowSize'
import { useLocation } from '@/contexts/LocationContext'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Evento {
  id:          string
  title:       string
  description: string | null
  date_start:  string
  city:        string
  state:       string
  cover_url:   string | null
}

type CarouselItem =
  | { type: 'evento'; data: Evento }
  | { type: 'anuncio' }

// ─── Constantes ───────────────────────────────────────────────────────────────

const ACCENT_COLORS = ['#a855f7','#f97316','#E8B84B','#ec4899','#22c55e','#06b6d4','#eab308']
const GOLD = '#E8B84B'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).replace('.', '')
}

// Configuração do carrossel por breakpoint
const getCarouselConfig = (width: number) => {
  if (width < 640) {
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

// Monta a lista de itens exibidos no carrossel:
// - Repete eventos até ter no mínimo 4 slots de evento
// - Insere o card "Anuncie aqui" na 3ª posição
function buildDisplayItems(eventos: Evento[]): CarouselItem[] {
  if (eventos.length === 0) return [{ type: 'anuncio' }]

  const minEventSlots = Math.max(eventos.length, 4)
  const repeated: CarouselItem[] = []
  let i = 0
  while (repeated.length < minEventSlots) {
    repeated.push({ type: 'evento', data: eventos[i % eventos.length] })
    i++
  }

  // Insere "Anuncie aqui" após o 2º evento
  repeated.splice(2, 0, { type: 'anuncio' })
  return repeated
}

// ─── Componente principal ─────────────────────────────────────────────────────

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

  // Busca eventos sempre que a cidade mudar
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

  const displayItems = useMemo(() => buildDisplayItems(eventos), [eventos])
  const total        = displayItems.length

  const next = useCallback(() => setCurrent(p => (p + 1) % total), [total])
  const prev = useCallback(() => setCurrent(p => (p - 1 + total) % total), [total])

  // Auto-avanço a cada 5 s
  useEffect(() => {
    if (paused) return
    const t = setInterval(next, 5000)
    return () => clearInterval(t)
  }, [paused, next])

  // Swipe
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev()
    touchStartX.current = null
  }

  // Posição relativa de cada item em relação ao banner central
  const getRelPos = (index: number) => {
    let pos = index - current
    if (pos >  total / 2) pos -= total
    if (pos < -total / 2) pos += total
    return pos
  }

  // Deslocamento horizontal dos cards laterais
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

  const activeItem = displayItems[current] ?? displayItems[0]

  // Índice de cor para eventos (ignora o slot de anúncio)
  const eventColorIndex = (item: CarouselItem, fallback: number) =>
    item.type === 'evento'
      ? eventos.findIndex(e => e.id === item.data.id) % ACCENT_COLORS.length
      : fallback

  return (
    <section
      className="w-full py-6 px-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Título da seção */}
      <p
        className="text-center text-xs tracking-widest uppercase mb-4"
        style={{ color: 'var(--text-3)', fontFamily: 'var(--font-dm-sans)' }}
      >
        {filtrado && city ? `Eventos em destaque em ${city}` : 'Eventos em destaque'}
      </p>

      {/* ─── Loading ──────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center" style={{ height: config.height }}>
          <Loader2 size={28} className="text-[#E8B84B] animate-spin" />
        </div>
      )}

      {/* ─── Carrossel ────────────────────────────────────────── */}
      {!loading && (
        <div
          className="relative flex items-center justify-center mx-auto overflow-visible"
          style={{ height: config.height, maxWidth: '100%' }}
        >
          {displayItems.map((item, index) => {
            const relPos   = getRelPos(index)
            const absPos   = Math.abs(relPos)
            const isCenter = relPos === 0

            if (absPos > config.maxSides) return null

            // ── BANNER CENTRAL ──────────────────────────────────
            if (isCenter) {

              // Card "Anuncie aqui" no centro
              if (item.type === 'anuncio') {
                return (
                  <a
                    key="anuncio-center"
                    href="/criar-evento"
                    className="absolute rounded-2xl overflow-hidden transition-all duration-500 cursor-pointer"
                    style={{
                      width:     config.centerWidth,
                      height:    config.height,
                      zIndex:    20,
                      left:      '50%',
                      transform: 'translateX(-50%)',
                      background: 'linear-gradient(135deg, #0c0c0c 0%, #111 55%, #1c1400 100%)',
                    }}
                  >
                    {/* Grid pontilhado de fundo */}
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `radial-gradient(${GOLD}0A 1px, transparent 1px)`,
                        backgroundSize:  '28px 28px',
                      }}
                    />

                    {/* Brilho dourado no canto superior direito */}
                    <div
                      className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none"
                      style={{ background: `radial-gradient(circle, ${GOLD}18, transparent 65%)` }}
                    />
                    {/* Brilho sutil no canto inferior esquerdo */}
                    <div
                      className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full pointer-events-none"
                      style={{ background: `radial-gradient(circle, ${GOLD}0C, transparent 65%)` }}
                    />

                    {/* Conteúdo central */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
                      {/* Ícone */}
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30` }}>
                        <Megaphone size={26} style={{ color: GOLD }} />
                      </div>

                      {/* Headline */}
                      <div>
                        <h3
                          className="text-white leading-tight"
                          style={{
                            fontFamily: 'var(--font-outfit)',
                            fontWeight: 600,
                            fontSize:   config.height >= 400 ? '2.25rem' : '1.5rem',
                          }}>
                          Anuncie{' '}
                          <span style={{ color: GOLD }}>aqui</span>
                        </h3>
                        <p
                          className="mt-2"
                          style={{
                            fontFamily: 'var(--font-dm-sans)',
                            color:      '#666',
                            fontSize:   config.height >= 400 ? '0.9rem' : '0.75rem',
                          }}>
                          Chegue a milhares de pessoas com seu evento
                        </p>
                      </div>

                      {/* CTA */}
                      <div
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold mt-1"
                        style={{ background: GOLD, color: '#070707', fontFamily: 'var(--font-dm-sans)' }}>
                        Criar evento grátis
                        <ArrowRight size={14} strokeWidth={2.5} />
                      </div>
                    </div>

                    {/* Linha dourada na base */}
                    <div
                      className="absolute bottom-0 left-0 right-0 h-[2px]"
                      style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
                    />

                    {/* Setas de navegação */}
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); prev() }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 border border-white/15 text-white hover:bg-black/50 transition-all duration-200 backdrop-blur-sm"
                      aria-label="Anterior">
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); next() }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 border border-white/15 text-white hover:bg-black/50 transition-all duration-200 backdrop-blur-sm"
                      aria-label="Próximo">
                      <ChevronRight size={20} />
                    </button>
                  </a>
                )
              }

              // Evento normal no centro
              const accent = ACCENT_COLORS[eventColorIndex(item, index)]
              const imgSrc = item.data.cover_url ?? `https://picsum.photos/seed/${item.data.id}/780/420`
              return (
                <a
                  key={`evento-center-${item.data.id}-${index}`}
                  href={`/evento/${item.data.id}`}
                  className="absolute rounded-2xl overflow-hidden transition-all duration-500 cursor-pointer"
                  style={{
                    width:     config.centerWidth,
                    height:    config.height,
                    zIndex:    20,
                    left:      '50%',
                    transform: 'translateX(-50%)',
                  }}
                >
                  <Image
                    src={imgSrc}
                    alt={item.data.title}
                    fill
                    className="object-cover brightness-110"
                    sizes="780px"
                    priority={index === 0}
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                  <div className="absolute top-6 left-6 z-10">
                    <span
                      className="px-3 py-1 rounded-full text-[11px] font-semibold tracking-widest uppercase"
                      style={{
                        background: `${accent}25`,
                        color:      accent,
                        border:     `1px solid ${accent}40`,
                        fontFamily: 'var(--font-dm-sans)',
                      }}>
                      {item.data.city} · {item.data.state}
                    </span>
                  </div>
                  <div
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
                  />
                  <button
                    onClick={e => { e.stopPropagation(); prev() }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 border border-white/15 text-white hover:bg-black/50 transition-all duration-200 backdrop-blur-sm"
                    aria-label="Banner anterior">
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); next() }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 border border-white/15 text-white hover:bg-black/50 transition-all duration-200 backdrop-blur-sm"
                    aria-label="Próximo banner">
                    <ChevronRight size={20} />
                  </button>
                </a>
              )
            }

            // ── CARDS LATERAIS ──────────────────────────────────
            const sideConfig = config.sideConfig[absPos - 1]
            const translateX = getSideTranslateX(relPos)
            const shadowDir  = relPos > 0
              ? 'linear-gradient(to right, rgba(0,0,0,0.75) 0%, transparent 60%)'
              : 'linear-gradient(to left,  rgba(0,0,0,0.75) 0%, transparent 60%)'

            // Card "Anuncie aqui" lateral
            if (item.type === 'anuncio') {
              return (
                <div
                  key="anuncio-side"
                  onClick={() => { setCurrent(index); setPaused(true); setTimeout(() => setPaused(false), 3000) }}
                  className="absolute rounded-xl overflow-hidden cursor-pointer transition-all duration-500 flex items-center justify-center"
                  style={{
                    width:     sideConfig.width,
                    height:    config.height,
                    opacity:   sideConfig.opacity,
                    zIndex:    20 - absPos * 3,
                    left:      '50%',
                    transform: `translateX(calc(-50% + ${translateX}px)) scale(${sideConfig.scale})`,
                    background: 'linear-gradient(135deg, #0d0d0d, #1c1400)',
                    border:     `1px solid ${GOLD}20`,
                  }}
                >
                  <Megaphone size={18} style={{ color: GOLD, opacity: 0.5 }} />
                  <div className="absolute inset-0 z-10" style={{ background: shadowDir }} />
                </div>
              )
            }

            // Evento lateral normal
            const accent = ACCENT_COLORS[eventColorIndex(item, index)]
            const imgSrc = item.data.cover_url ?? `https://picsum.photos/seed/${item.data.id}/780/420`
            return (
              <div
                key={`evento-side-${item.data.id}-${index}`}
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
                <Image
                  src={imgSrc}
                  alt={item.data.title}
                  fill
                  className="object-cover"
                  sizes="175px"
                  unoptimized
                />
                <div className="absolute inset-0 z-10" style={{ background: shadowDir }} />
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Informações abaixo do banner ─────────────────────── */}
      {!loading && activeItem && (
        <div className="mt-5 flex flex-col items-center gap-3 text-center transition-all duration-300">

          {activeItem.type === 'anuncio' ? (
            // Info do slot "Anuncie aqui"
            <>
              <h2
                className="text-xl md:text-2xl leading-tight"
                style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500, color: 'var(--text-1)' }}>
                Publique seu evento no{' '}
                <span style={{ color: GOLD }}>Tipo7</span>
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <span
                  className="text-sm"
                  style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text-2)' }}>
                  Venda ingressos, gerencie equipes e divulgue para todo o Brasil
                </span>
                <a
                  href="/criar-evento"
                  className="group flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[#070707] font-semibold text-sm transition-all duration-200"
                  style={{ background: GOLD, fontFamily: 'var(--font-dm-sans)' }}>
                  Criar evento grátis
                  <ArrowRight size={13} strokeWidth={2.5} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </a>
              </div>
            </>
          ) : (
            // Info do evento ativo
            <>
              <h2
                className="text-xl md:text-2xl leading-tight tracking-wide"
                style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500, color: 'var(--text-1)' }}>
                {activeItem.data.title}
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <span className="flex items-center gap-1.5 text-sm" style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text-2)' }}>
                  <MapPin size={13} style={{ color: ACCENT_COLORS[eventColorIndex(activeItem, current)] }} />
                  {activeItem.data.city} · {activeItem.data.state}
                </span>
                <span className="flex items-center gap-1.5 text-sm" style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text-2)' }}>
                  <Calendar size={13} style={{ color: ACCENT_COLORS[eventColorIndex(activeItem, current)] }} />
                  {formatDate(activeItem.data.date_start)}
                </span>
                <a
                  href={`/evento/${activeItem.data.id}`}
                  className="group flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[#070707] font-semibold text-sm transition-all duration-200"
                  style={{ background: ACCENT_COLORS[eventColorIndex(activeItem, current)], fontFamily: 'var(--font-dm-sans)' }}>
                  Ver ingressos
                  <ArrowRight size={13} strokeWidth={2.5} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </a>
              </div>
            </>
          )}

          {/* Bolinhas indicadoras */}
          <div className="flex items-center gap-2 mt-1">
            {displayItems.map((item, index) => (
              <button
                key={index}
                onClick={() => { setCurrent(index); setPaused(true); setTimeout(() => setPaused(false), 3000) }}
                className="rounded-full transition-all duration-300"
                style={{
                  width:      current === index ? '22px' : '6px',
                  height:     '6px',
                  background: current === index
                    ? (item.type === 'anuncio' ? GOLD : ACCENT_COLORS[eventColorIndex(item, index)])
                    : 'rgba(0,0,0,0.15)',
                }}
                aria-label={`Ir para item ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
