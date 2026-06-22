'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import {
  MapPin, Calendar, Clock, Tag, ChevronDown, ChevronUp,
  Ticket, AlertCircle, ExternalLink, Music, Loader2,
} from 'lucide-react'
import { PainelOrganizador } from './PainelOrganizador'
import type { IngressoEditavel } from './PainelIngressos'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Evento {
  id:                 string
  title:              string
  description:        string
  category:           string
  status:             'rascunho' | 'publicado' | 'cancelado'
  dateStart:          string
  dateEnd:            string
  venueName:          string
  city:               string
  state:              string
  street:             string
  ticketMode:         'individual' | 'pacote' | 'ambos' | null
  packageDiscountPct: number
  bannerUrl:          string | null
}

interface Attraction {
  name:          string
  scheduledTime: string
}

interface Dia {
  id:          string
  dayNumber:   number
  date:        string
  startTime:   string
  endTime:     string
  attractions: Attraction[]
}

interface Ingresso {
  id:         string
  name:       string
  price:      number
  quantity:   number
  eventDayId: string | null
}

interface Props {
  evento:         Evento
  dias:           Dia[]
  ingressos:      Ingresso[]
  isOwner:        boolean
  capacity:       number | null
  soldByTicket:   Record<string, number>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCENT = '#E8B84B'

function formatDate(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDateShort(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

function formatTime(t: string) {
  return t ? t.slice(0, 5) : ''
}

function formatPrice(price: number) {
  if (price === 0) return 'Gratuito'
  return `R$ ${price.toFixed(2).replace('.', ',')}`
}

// ─── Linha de ingresso com seletor +/- ───────────────────────────────────────

function TicketRow({
  ingresso, qty, onQty,
}: {
  ingresso: Ingresso
  qty:      number
  onQty:    (q: number) => void
}) {
  const gratuito = ingresso.price === 0
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#111] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {ingresso.name}
        </p>
        <p className="text-sm font-semibold mt-0.5"
           style={{ color: gratuito ? '#4ade80' : ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          {formatPrice(ingresso.price)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onQty(qty - 1)}
          disabled={qty === 0}
          className="w-7 h-7 rounded-lg border border-[#222] flex items-center justify-center text-white text-sm disabled:opacity-30 hover:border-[#333] transition-colors">
          –
        </button>
        <span className="text-white text-sm w-5 text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {qty}
        </span>
        <button
          onClick={() => onQty(qty + 1)}
          disabled={qty >= ingresso.quantity}
          className="w-7 h-7 rounded-lg border border-[#222] flex items-center justify-center text-white text-sm disabled:opacity-30 hover:border-[#333] transition-colors">
          +
        </button>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function EventoPageClient({ evento, dias, ingressos, isOwner, capacity, soldByTicket }: Props) {
  // Índice do dia aberto no accordion de programação (0 = primeiro aberto por padrão)
  const [openDay,    setOpenDay]    = useState(0)
  const [selection,  setSelection]  = useState<Record<string, number>>({})
  const [loading,     setLoading]     = useState(false)
  const [loadingPix,  setLoadingPix]  = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const setQty = (id: string, qty: number, max: number) =>
    setSelection(prev => ({ ...prev, [id]: Math.max(0, Math.min(qty, max)) }))

  const total = useMemo(
    () => ingressos.reduce((sum, t) => sum + (selection[t.id] ?? 0) * t.price, 0),
    [selection, ingressos],
  )

  const totalItems = useMemo(
    () => Object.values(selection).reduce((a, b) => a + b, 0),
    [selection],
  )

  const ingressosPacote     = ingressos.filter(t => t.eventDayId === null)
  const ingressosIndividual = ingressos.filter(t => t.eventDayId !== null)

  // Se ticketMode não está definido, exibe todos os ingressos sem separação
  const modoSimples = evento.ticketMode === null || evento.ticketMode === 'individual'

  const isRascunho = evento.status === 'rascunho'

  function getItems() {
    return Object.entries(selection)
      .filter(([, qty]) => qty > 0)
      .map(([ticketId, quantity]) => ({ ticketId, quantity }))
  }

  async function handleCheckout() {
    const items = getItems()
    if (!items.length) return

    setLoading(true)
    setCheckoutError(null)

    try {
      const res = await fetch('/api/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ eventoId: evento.id, items }),
      })

      const data = await res.json()

      if (!res.ok) {
        setCheckoutError(data.error ?? 'Erro ao processar checkout')
        return
      }

      window.location.href = data.checkoutUrl
    } catch {
      setCheckoutError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePixCheckout() {
    const items = getItems()
    if (!items.length) return

    setLoadingPix(true)
    setCheckoutError(null)

    try {
      const res = await fetch('/api/checkout/pix', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ eventoId: evento.id, items }),
      })

      const data = await res.json()

      if (!res.ok) {
        setCheckoutError(data.error ?? 'Erro ao gerar PIX')
        return
      }

      window.location.href = `/checkout/pix/${data.orderId}`
    } catch {
      setCheckoutError('Erro de conexão. Tente novamente.')
    } finally {
      setLoadingPix(false)
    }
  }

  return (
    <>
      {/* ── Barra do promotor ────────────────────────────────────────────── */}
      {isOwner && (
        <div className="w-full border-b border-[#E8B84B]/20 bg-[#E8B84B]/[0.06] px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={13} className="text-[#E8B84B] shrink-0" />
            <span className="text-[#E8B84B] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {isRascunho ? 'Rascunho — não visível ao público' : 'Você é o organizador deste evento'}
            </span>
          </div>
          <a
            href={`/criar-evento/${evento.id}`}
            className="flex items-center gap-1 text-[#E8B84B] text-xs hover:underline shrink-0"
            style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Editar <ExternalLink size={11} />
          </a>
        </div>
      )}

      {/* ── Hero banner — mesmo tamanho máximo do carrossel (780px) ────── */}
      <div className="px-4 pt-6">
        <div className="relative w-full max-w-[780px] mx-auto rounded-2xl overflow-hidden" style={{ height: 420 }}>
          {evento.bannerUrl
            ? <Image
                src={evento.bannerUrl}
                alt={evento.title}
                fill
                className="object-cover brightness-110"
                sizes="780px"
                priority
                unoptimized
              />
            : <div className="absolute inset-0 bg-gradient-to-br from-[#111] to-[#0d0d0d]" />
          }
          {/* Gradiente apenas no rodapé para o texto ser legível, topo livre */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-[#070707]/25 to-transparent" />

          {/* Título e categoria no rodapé do banner */}
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-8">
          {evento.category && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase mb-3"
              style={{
                background:  `${ACCENT}20`,
                color:       ACCENT,
                border:      `1px solid ${ACCENT}40`,
                fontFamily:  'var(--font-dm-sans)',
              }}>
              <Tag size={10} />
              {evento.category}
            </span>
          )}
          <h1
            className="text-white text-3xl md:text-4xl leading-tight"
            style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600, textShadow: '0 2px 24px rgba(0,0,0,0.9)' }}>
            {evento.title}
          </h1>
        </div>
        </div>
      </div>

      {/* ── Barra de info (data, hora, local) ───────────────────────────── */}
      <div className="border-b border-[#111] bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap gap-5">
          <span className="flex items-center gap-2 text-[#888] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <Calendar size={14} style={{ color: ACCENT }} />
            {formatDate(evento.dateStart)}
            {evento.dateEnd && evento.dateEnd !== evento.dateStart && (
              <> até {formatDate(evento.dateEnd)}</>
            )}
          </span>
          {dias[0]?.startTime && (
            <span className="flex items-center gap-2 text-[#888] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <Clock size={14} style={{ color: ACCENT }} />
              {formatTime(dias[0].startTime)}
              {dias[0].endTime && ` – ${formatTime(dias[0].endTime)}`}
            </span>
          )}
          <span className="flex items-center gap-2 text-[#888] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <MapPin size={14} style={{ color: ACCENT }} />
            {evento.venueName ? `${evento.venueName} · ` : ''}
            {evento.city} · {evento.state}
          </span>
        </div>
      </div>

      {/* ── Conteúdo principal ───────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">

        {/* ── Coluna esquerda ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-10">

          {/* Sobre o evento */}
          {evento.description && (
            <section>
              <h2 className="text-white text-lg font-medium mb-4"
                  style={{ fontFamily: 'var(--font-outfit)' }}>
                Sobre o evento
              </h2>
              <p className="text-[#888] text-sm leading-relaxed whitespace-pre-line"
                 style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {evento.description}
              </p>
            </section>
          )}

          {/* Programação */}
          {dias.length > 0 && (
            <section>
              <h2 className="text-white text-lg font-medium mb-4"
                  style={{ fontFamily: 'var(--font-outfit)' }}>
                Programação
              </h2>
              <div className="flex flex-col gap-2">
                {dias.map((dia, i) => (
                  <div key={dia.id} className="rounded-xl border border-[#1a1a1a] overflow-hidden">
                    {/* Cabeçalho do dia (clicável) */}
                    <button
                      onClick={() => setOpenDay(openDay === i ? -1 : i)}
                      className="w-full flex items-center justify-between px-5 py-4 bg-[#0d0d0d] hover:bg-[#111] transition-colors text-left">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-[#070707] shrink-0"
                          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                          {dia.dayNumber}
                        </span>
                        <div>
                          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                            {dias.length > 1 ? `Dia ${dia.dayNumber}` : 'Programação'}
                            {dia.date && (
                              <span className="text-[#555] font-normal ml-2">
                                · {formatDateShort(dia.date)}
                              </span>
                            )}
                          </p>
                          {dia.startTime && (
                            <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                              {formatTime(dia.startTime)}
                              {dia.endTime ? ` – ${formatTime(dia.endTime)}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      {openDay === i
                        ? <ChevronUp  size={15} className="text-[#444] shrink-0" />
                        : <ChevronDown size={15} className="text-[#444] shrink-0" />
                      }
                    </button>

                    {/* Atrações do dia */}
                    {openDay === i && (
                      <div className="px-5 py-3 bg-[#0a0a0a]">
                        {dia.attractions.length > 0
                          ? dia.attractions.map((a, ai) => (
                              <div key={ai}
                                   className="flex items-center gap-3 py-2.5 border-b border-[#0f0f0f] last:border-0">
                                <Music size={11} className="text-[#333] shrink-0" />
                                <span className="text-white text-sm flex-1"
                                      style={{ fontFamily: 'var(--font-dm-sans)' }}>
                                  {a.name}
                                </span>
                                {a.scheduledTime && (
                                  <span className="text-[#555] text-xs shrink-0"
                                        style={{ fontFamily: 'var(--font-dm-sans)' }}>
                                    {formatTime(a.scheduledTime)}
                                  </span>
                                )}
                              </div>
                            ))
                          : <p className="text-[#444] text-xs py-2"
                               style={{ fontFamily: 'var(--font-dm-sans)' }}>
                              Programação a confirmar
                            </p>
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Local */}
          {(evento.venueName || evento.street) && (
            <section>
              <h2 className="text-white text-lg font-medium mb-4"
                  style={{ fontFamily: 'var(--font-outfit)' }}>
                Local
              </h2>
              <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] p-5 flex items-start gap-3">
                <MapPin size={16} style={{ color: ACCENT }} className="shrink-0 mt-0.5" />
                <div>
                  {evento.venueName && (
                    <p className="text-white text-sm font-medium"
                       style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {evento.venueName}
                    </p>
                  )}
                  {evento.street && (
                    <p className="text-[#555] text-xs mt-1"
                       style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {evento.street}
                    </p>
                  )}
                  <p className="text-[#555] text-xs mt-0.5"
                     style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {evento.city} · {evento.state}
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* ── Coluna direita — painel de gestão (organizador) ou compra ──── */}
        <div className="lg:sticky lg:top-24">
          {isOwner && (
            <PainelOrganizador
              eventoId={evento.id}
              capacity={capacity}
              ingressos={ingressos.map((t): IngressoEditavel => ({
                id:       t.id,
                name:     t.name,
                price:    t.price,
                quantity: t.quantity,
                sold:     soldByTicket[t.id] ?? 0,
              }))}
            />
          )}
          {!isOwner && (
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden">

            {/* Cabeçalho do painel */}
            <div className="px-5 py-4 border-b border-[#141414]">
              <div className="flex items-center gap-2">
                <Ticket size={14} style={{ color: ACCENT }} />
                <p className="text-white text-sm font-medium"
                   style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Ingressos
                </p>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-5">

              {/* ── Modo simples (individual ou sem modo definido) ─────── */}
              {modoSimples && (
                <>
                  {ingressosIndividual.length > 0 && dias.map(dia => {
                    const tickets = ingressosIndividual.filter(t => t.eventDayId === dia.id)
                    if (!tickets.length) return null
                    return (
                      <div key={dia.id} className="flex flex-col gap-1">
                        {dias.length > 1 && (
                          <p className="text-[#444] text-xs mb-1"
                             style={{ fontFamily: 'var(--font-dm-sans)' }}>
                            Dia {dia.dayNumber}
                            {dia.date ? ` · ${formatDateShort(dia.date)}` : ''}
                          </p>
                        )}
                        {tickets.map(t => (
                          <TicketRow key={t.id} ingresso={t}
                            qty={selection[t.id] ?? 0}
                            onQty={q => setQty(t.id, q, t.quantity)} />
                        ))}
                      </div>
                    )
                  })}
                  {/* Pacotes no modo simples (eventDayId null) */}
                  {ingressosPacote.map(t => (
                    <TicketRow key={t.id} ingresso={t}
                      qty={selection[t.id] ?? 0}
                      onQty={q => setQty(t.id, q, t.quantity)} />
                  ))}
                </>
              )}

              {/* ── Modo pacote ───────────────────────────────────────── */}
              {evento.ticketMode === 'pacote' && (
                <div className="flex flex-col gap-1">
                  {ingressosPacote.map(t => (
                    <TicketRow key={t.id} ingresso={t}
                      qty={selection[t.id] ?? 0}
                      onQty={q => setQty(t.id, q, t.quantity)} />
                  ))}
                </div>
              )}

              {/* ── Modo ambos ────────────────────────────────────────── */}
              {evento.ticketMode === 'ambos' && (
                <>
                  {/* Pacote completo */}
                  {ingressosPacote.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[#555] text-[11px] font-semibold uppercase tracking-wider"
                           style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          Pacote completo
                        </p>
                        {evento.packageDiscountPct > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                                style={{ background: '#22c55e20', color: '#4ade80' }}>
                            -{evento.packageDiscountPct}%
                          </span>
                        )}
                      </div>
                      {ingressosPacote.map(t => (
                        <TicketRow key={t.id} ingresso={t}
                          qty={selection[t.id] ?? 0}
                          onQty={q => setQty(t.id, q, t.quantity)} />
                      ))}
                    </div>
                  )}

                  {/* Por dia */}
                  {ingressosIndividual.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <p className="text-[#555] text-[11px] font-semibold uppercase tracking-wider"
                         style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        Por dia
                      </p>
                      {dias.map(dia => {
                        const tickets = ingressosIndividual.filter(t => t.eventDayId === dia.id)
                        if (!tickets.length) return null
                        return (
                          <div key={dia.id} className="flex flex-col gap-1">
                            {dias.length > 1 && (
                              <p className="text-[#444] text-xs"
                                 style={{ fontFamily: 'var(--font-dm-sans)' }}>
                                Dia {dia.dayNumber}{dia.date ? ` · ${formatDateShort(dia.date)}` : ''}
                              </p>
                            )}
                            {tickets.map(t => (
                              <TicketRow key={t.id} ingresso={t}
                                qty={selection[t.id] ?? 0}
                                onQty={q => setQty(t.id, q, t.quantity)} />
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Sem ingressos */}
              {ingressos.length === 0 && (
                <p className="text-[#444] text-sm text-center py-6"
                   style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Ingressos não cadastrados.
                </p>
              )}

              {/* Total + botão */}
              {ingressos.length > 0 && (
                <div className="border-t border-[#141414] pt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[#555] text-sm"
                          style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      Total{totalItems > 0 ? ` (${totalItems} ingresso${totalItems > 1 ? 's' : ''})` : ''}
                    </span>
                    <span className="text-white text-base font-semibold"
                          style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {totalItems === 0 ? '—' : formatPrice(total)}
                    </span>
                  </div>

                  {checkoutError && (
                    <p className="text-red-400 text-xs text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {checkoutError}
                    </p>
                  )}

                  {/* Botão PIX */}
                  <button
                    onClick={handlePixCheckout}
                    disabled={loadingPix || loading || totalItems === 0}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-105"
                    style={{
                      background:  totalItems > 0 ? '#32D583' : '#0d1a12',
                      color:       totalItems > 0 ? '#071209' : '#1a3322',
                      border:      totalItems > 0 ? 'none' : '1px solid #0d1a12',
                      fontFamily:  'var(--font-dm-sans)',
                    }}>
                    {loadingPix
                      ? <><Loader2 size={14} className="animate-spin" /> Gerando PIX...</>
                      : 'Pagar com PIX'
                    }
                  </button>

                  {/* Separador */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-[#111]" />
                    <span className="text-[#2a2a2a] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>ou</span>
                    <div className="flex-1 h-px bg-[#111]" />
                  </div>

                  {/* Botão Cartão/Boleto */}
                  <button
                    onClick={handleCheckout}
                    disabled={loading || loadingPix || totalItems === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
                    style={{
                      background:  'transparent',
                      color:       totalItems > 0 ? ACCENT : '#333',
                      border:      `1px solid ${totalItems > 0 ? ACCENT + '40' : '#1a1a1a'}`,
                      fontFamily:  'var(--font-dm-sans)',
                    }}>
                    {loading
                      ? <><Loader2 size={14} className="animate-spin" /> Processando...</>
                      : 'Cartão ou Boleto'
                    }
                  </button>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </>
  )
}
