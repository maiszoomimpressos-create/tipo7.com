'use client'

import { useState, useMemo, useRef } from 'react'
import Image from 'next/image'
import { QRCodeCanvas } from 'qrcode.react'
import {
  MapPin, Calendar, Clock, Tag, ChevronDown, ChevronUp,
  Ticket, AlertCircle, ExternalLink, Music, Loader2,
  Pencil, X, Check, Camera, Copy, Download, QrCode, Lock,
  Shield, Car, UtensilsCrossed, Beer, Accessibility, Wifi,
  Baby, HeartPulse, Cigarette,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PainelOrganizador } from './PainelOrganizador'
import type { IngressoEditavel } from './PainelIngressos'
import { CheckoutCardPanel } from './CheckoutCardPanel'
import { createClient } from '@/lib/supabase/client'

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
  feeMode:            'promotor' | 'comprador' | 'mista'
  feePct:             number
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
  evento:          Evento
  dias:            Dia[]
  ingressos:       Ingresso[]
  isOwner:         boolean
  capacity:        number | null
  soldByTicket:    Record<string, number>
  atributosAtivos: { id: string; name: string; icon: string; value_json?: Record<string, string> | null }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCENT = '#E8B84B'

// Mapeamento de nome de ícone (string do banco) → componente Lucide
const ICON_MAP: Record<string, LucideIcon> = {
  Shield, Car, UtensilsCrossed, Beer, Accessibility, Wifi,
  Baby, HeartPulse, Cigarette, Camera, Tag,
}

const CATEGORIAS = [
  'Show', 'Festa', 'Festival', 'Teatro', 'Esporte',
  'Gastronomia', 'Arte', 'Tecnologia', 'Religioso', 'Outro',
]

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
  ingresso, qty, onQty, displayPrice,
}: {
  ingresso:     Ingresso
  qty:          number
  onQty:        (q: number) => void
  displayPrice: number
}) {
  const gratuito = displayPrice === 0
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#111] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {ingresso.name}
        </p>
        <p className="text-sm font-semibold mt-0.5"
           style={{ color: gratuito ? '#4ade80' : ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          {formatPrice(displayPrice)}
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

export function EventoPageClient({ evento, dias, ingressos, isOwner, capacity, soldByTicket, atributosAtivos }: Props) {
  // Accordion e checkout
  const [openDay,       setOpenDay]       = useState(0)
  const [selection,     setSelection]     = useState<Record<string, number>>({})
  const [loadingPix,    setLoadingPix]    = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [showCardForm,  setShowCardForm]  = useState(false)

  // Inline edit state (owner only)
  const [editField,       setEditField]       = useState<string | null>(null)
  const [editTitle,       setEditTitle]       = useState(evento.title)
  const [editDesc,        setEditDesc]        = useState(evento.description)
  const [editCategory,    setEditCategory]    = useState(evento.category)
  const [currentTitle,    setCurrentTitle]    = useState(evento.title)
  const [currentDesc,     setCurrentDesc]     = useState(evento.description)
  const [currentCategory, setCurrentCategory] = useState(evento.category)
  const [currentBanner,   setCurrentBanner]   = useState(evento.bannerUrl)
  const [fieldSaving,     setFieldSaving]     = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const [linkCopiado,     setLinkCopiado]     = useState(false)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const qrCanvasRef    = useRef<HTMLCanvasElement>(null)

  const eventUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/evento/${evento.id}`
    : `/evento/${evento.id}`

  const copiarLink = async () => {
    await navigator.clipboard.writeText(eventUrl)
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2500)
  }

  const baixarQR = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('#qr-evento-canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `qr-${evento.id}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  // ── Edit helpers ──────────────────────────────────────────────────────────

  function cancelEdit() {
    if (editField === 'title')       setEditTitle(currentTitle)
    if (editField === 'description') setEditDesc(currentDesc)
    if (editField === 'category')    setEditCategory(currentCategory)
    setEditField(null)
  }

  async function saveField(field: string, dbData: Record<string, unknown>, onSuccess: () => void) {
    setFieldSaving(true)
    try {
      const supabase = createClient()
      await supabase.from('events').update(dbData).eq('id', evento.id)
      onSuccess()
      setEditField(null)
    } catch { /* silently fail — field stays in edit mode */ }
    finally { setFieldSaving(false) }
  }

  async function handleBannerFile(file: File) {
    if (file.size > 10 * 1024 * 1024) return
    setBannerUploading(true)
    try {
      const supabase = createClient()
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${evento.id}/banner.${ext}`
      const { error } = await supabase.storage
        .from('event-images')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data } = supabase.storage.from('event-images').getPublicUrl(path)
      await supabase.from('events').update({ banner_url: data.publicUrl }).eq('id', evento.id)
      setCurrentBanner(`${data.publicUrl}?t=${Date.now()}`)
    } finally { setBannerUploading(false) }
  }

  // ── Checkout helpers ──────────────────────────────────────────────────────

  const setQty = (id: string, qty: number, max: number) =>
    setSelection(prev => ({ ...prev, [id]: Math.max(0, Math.min(qty, max)) }))

  // displayPrice = preço que o comprador vê e paga conforme o modo de taxa do evento
  const effectivePrice = (facePrice: number) => {
    if (evento.feeMode === 'comprador') return Math.round(facePrice * (1 + evento.feePct / 100) * 100) / 100
    if (evento.feeMode === 'mista')     return Math.round(facePrice * (1 + evento.feePct / 2 / 100) * 100) / 100
    return facePrice
  }

  const total = useMemo(
    () => ingressos.reduce((sum, t) => sum + (selection[t.id] ?? 0) * effectivePrice(t.price), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selection, ingressos, evento.feeMode, evento.feePct],
  )

  const totalItems = useMemo(
    () => Object.values(selection).reduce((a, b) => a + b, 0),
    [selection],
  )

  const ingressosPacote     = ingressos.filter(t => t.eventDayId === null)
  const ingressosIndividual = ingressos.filter(t => t.eventDayId !== null)
  const modoSimples = evento.ticketMode === null || evento.ticketMode === 'individual'
  const isRascunho  = evento.status === 'rascunho'
  const editFormUrl = `/criar-evento/${evento.id}`

  function getItems() {
    return Object.entries(selection)
      .filter(([, qty]) => qty > 0)
      .map(([ticketId, quantity]) => ({ ticketId, quantity }))
  }

  async function handlePixCheckout() {
    const items = getItems()
    if (!items.length) return
    setLoadingPix(true); setCheckoutError(null)
    try {
      const res = await fetch('/api/checkout/pix', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ eventoId: evento.id, items }),
      })
      const data = await res.json()
      if (!res.ok) { setCheckoutError(data.error ?? 'Erro ao gerar PIX'); return }
      window.location.href = `/checkout/pix/${data.orderId}`
    } catch {
      setCheckoutError('Erro de conexão. Tente novamente.')
    } finally { setLoadingPix(false) }
  }

  // ── Shared UI pieces (inlined to avoid inner-component remount issues) ────

  const pencilBtn = (field: string) => (
    <button
      onClick={() => { cancelEdit(); setEditField(field) }}
      className="w-6 h-6 rounded-md flex items-center justify-center text-[#444] hover:text-[#E8B84B] hover:bg-[#E8B84B]/10 transition-all shrink-0"
      title="Editar">
      <Pencil size={12} />
    </button>
  )

  const saveCancelBtns = (onSave: () => void) => (
    <div className="flex items-center gap-1.5 mt-2">
      <button
        onClick={onSave}
        disabled={fieldSaving}
        className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold text-[#070707] disabled:opacity-50 transition-all"
        style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
        {fieldSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
        Salvar
      </button>
      <button
        onClick={cancelEdit}
        className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-[#555] hover:text-white border border-[#222] hover:border-[#333] transition-all"
        style={{ fontFamily: 'var(--font-dm-sans)' }}>
        <X size={11} /> Cancelar
      </button>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Barra do promotor ────────────────────────────────────────────── */}
      {isOwner && (
        <div className="w-full border-b border-[#E8B84B]/20 bg-[#E8B84B]/[0.06] px-4 md:px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={13} className="text-[#E8B84B] shrink-0" />
            <span className="text-[#E8B84B] text-xs truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {isRascunho ? 'Rascunho — não visível ao público' : 'Você é o organizador deste evento'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/minha-area"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: '#E8B84B', color: '#070707', fontFamily: 'var(--font-dm-sans)' }}>
              Minha área
            </a>
            <a
              href={editFormUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'rgba(232,184,75,0.12)', color: '#E8B84B', border: '1px solid rgba(232,184,75,0.25)', fontFamily: 'var(--font-dm-sans)' }}>
              Editar <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}

      {/* ── Hero banner ──────────────────────────────────────────────────── */}
      <div className="px-4 pt-6">
        <div
          className="relative w-full max-w-[780px] mx-auto rounded-2xl overflow-hidden"
          style={{ height: 420 }}>

          {currentBanner
            ? <Image
                src={currentBanner}
                alt={currentTitle}
                fill
                className="object-cover brightness-110"
                sizes="780px"
                priority
                unoptimized
              />
            : <div className="absolute inset-0 bg-gradient-to-br from-[#111] to-[#0d0d0d]" />
          }
          <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-[#070707]/25 to-transparent" />

          {/* Upload overlay (owner only) */}
          {isOwner && (
            <>
              {/* Etiqueta de medidas — canto superior esquerdo */}
              <div
                className="absolute top-3 left-3 z-20 flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg pointer-events-none"
                style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(4px)' }}>
                <span className="text-[10px] font-semibold tracking-wider uppercase"
                      style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                  Banner
                </span>
                <span className="text-white text-[11px] font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  780 × 420 px
                </span>
                <span className="text-[#666] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Proporção 16:9 · máx 10 MB
                </span>
                <span className="text-[#555] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  JPG, PNG ou WEBP
                </span>
              </div>

              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleBannerFile(f) }}
              />
              <button
                onClick={() => bannerInputRef.current?.click()}
                className="absolute inset-0 z-10 flex items-end justify-end p-4 bg-black/0 hover:bg-black/25 transition-all group"
                style={{ cursor: 'pointer' }}>
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium opacity-0 group-hover:opacity-100 transition-all"
                  style={{ background: 'rgba(0,0,0,0.80)', color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                  {bannerUploading
                    ? <><Loader2 size={12} className="animate-spin" /> Enviando...</>
                    : <><Camera size={12} /> Alterar banner</>
                  }
                </span>
              </button>
            </>
          )}

          {/* Título e categoria no rodapé do banner */}
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 z-20">

            {/* ── Categoria ── */}
            {editField === 'category' ? (
              <div className="mb-3">
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {CATEGORIAS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditCategory(prev => prev === c ? '' : c)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                      style={{
                        background: editCategory === c ? ACCENT : 'rgba(0,0,0,0.65)',
                        color:      editCategory === c ? '#070707' : '#888',
                        border:     `1px solid ${editCategory === c ? ACCENT : '#444'}`,
                        fontFamily: 'var(--font-dm-sans)',
                      }}>
                      {c}
                    </button>
                  ))}
                </div>
                {saveCancelBtns(() =>
                  saveField('category', { category: editCategory }, () => setCurrentCategory(editCategory))
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-3">
                {currentCategory ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase"
                    style={{
                      background: `${ACCENT}20`,
                      color:      ACCENT,
                      border:     `1px solid ${ACCENT}40`,
                      fontFamily: 'var(--font-dm-sans)',
                    }}>
                    <Tag size={10} />
                    {currentCategory}
                  </span>
                ) : isOwner ? (
                  <span className="text-[#555] text-xs italic" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Sem categoria
                  </span>
                ) : null}
                {isOwner && pencilBtn('category')}
              </div>
            )}

            {/* ── Título ── */}
            {editField === 'title' ? (
              <div>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  maxLength={120}
                  autoFocus
                  className="w-full rounded-xl px-4 py-2 text-white text-2xl outline-none"
                  style={{
                    fontFamily:     'var(--font-outfit)',
                    fontWeight:     600,
                    background:     'rgba(0,0,0,0.55)',
                    border:         `1px solid ${ACCENT}50`,
                    backdropFilter: 'blur(4px)',
                  }}
                />
                {saveCancelBtns(() =>
                  saveField('title', { title: editTitle.trim() || evento.title }, () => setCurrentTitle(editTitle.trim() || evento.title))
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <h1
                  className="text-white text-3xl md:text-4xl leading-tight flex-1"
                  style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600, textShadow: '0 2px 24px rgba(0,0,0,0.9)' }}>
                  {currentTitle}
                </h1>
                {isOwner && pencilBtn('title')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Barra de info (data, hora, local) ───────────────────────────── */}
      <div className="border-b border-[#111] bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center gap-5">
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
          {isOwner && (
            <a
              href={editFormUrl}
              className="flex items-center gap-1.5 text-xs ml-auto shrink-0 text-[#444] hover:text-[#E8B84B] transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <Pencil size={11} /> Editar data e local
            </a>
          )}
        </div>
      </div>

      {/* ── Estrutura do evento — faixa pública de destaque ─────────────── */}
      {atributosAtivos.length > 0 && (
        <div className="border-b border-[#111]" style={{ background: '#09090b' }}>
          <div className="max-w-6xl mx-auto px-6 py-5">
            <p
              className="text-[#444] text-[10px] uppercase tracking-widest mb-3"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>
              O evento conta com
            </p>
            <div className="flex flex-wrap gap-2.5">
              {atributosAtivos.map(attr => {
                const Icon = ICON_MAP[attr.icon] ?? Tag
                // Detalhes do estacionamento pago
                const parking = attr.value_json
                const parkingPago   = parking?.parking_type === 'pago'
                const parkingLabel  = parking
                  ? parkingPago
                    ? `Estacionamento pago · ${parking.spots} vagas · R$ ${Number(parking.price_per_spot).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / vaga`
                    : 'Estacionamento gratuito'
                  : null
                return (
                  <div
                    key={attr.id}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
                    style={{
                      background: 'rgba(232,184,75,0.06)',
                      border:     '1px solid rgba(232,184,75,0.18)',
                    }}>
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(232,184,75,0.12)' }}>
                      <Icon size={14} style={{ color: ACCENT }} />
                    </div>
                    <div className="flex flex-col">
                      <span
                        className="text-[#bbb] text-sm font-medium leading-tight"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {attr.name}
                      </span>
                      {parkingLabel && (
                        <span
                          className="text-[#666] text-xs leading-tight mt-0.5"
                          style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          {parkingLabel}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Painel de divulgação (somente dono) ─────────────────────────── */}
      {isOwner && (
        <div className="border-b border-[#111] bg-[#080808]">
          <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center gap-6">

            {evento.status === 'publicado' ? (
              <>
                {/* QR code */}
                <div className="relative shrink-0">
                  <div className="p-2 rounded-xl bg-white">
                    <QRCodeCanvas
                      id="qr-evento-canvas"
                      value={eventUrl}
                      size={100}
                      bgColor="#ffffff"
                      fgColor="#070707"
                      level="M"
                    />
                  </div>
                  <div
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: ACCENT }}>
                    <QrCode size={10} style={{ color: '#070707' }} />
                  </div>
                </div>

                {/* URL + ações */}
                <div className="flex-1 min-w-0 flex flex-col gap-3">
                  <div>
                    <p className="text-[#444] text-[10px] uppercase tracking-widest mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      Link do evento
                    </p>
                    <p className="text-[#666] text-sm truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {eventUrl}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={copiarLink}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                      style={{
                        background: linkCopiado ? 'rgba(34,197,94,0.10)' : 'rgba(232,184,75,0.08)',
                        border:     `1px solid ${linkCopiado ? 'rgba(34,197,94,0.30)' : 'rgba(232,184,75,0.25)'}`,
                        color:      linkCopiado ? '#22c55e' : ACCENT,
                        fontFamily: 'var(--font-dm-sans)',
                      }}>
                      {linkCopiado
                        ? <><Check size={12} /> Link copiado!</>
                        : <><Copy size={12} /> Copiar link</>
                      }
                    </button>

                    <button
                      type="button"
                      onClick={baixarQR}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border:     '1px solid #1e1e1e',
                        color:      '#555',
                        fontFamily: 'var(--font-dm-sans)',
                      }}>
                      <Download size={12} /> Baixar QR
                    </button>

                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Garanta seu ingresso para ${evento.title}! 🎟️ ${eventUrl}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                      style={{
                        background: 'rgba(37,211,102,0.08)',
                        border:     '1px solid rgba(37,211,102,0.20)',
                        color:      '#25D366',
                        fontFamily: 'var(--font-dm-sans)',
                      }}>
                      <ExternalLink size={12} /> Compartilhar no WhatsApp
                    </a>
                  </div>
                </div>
              </>
            ) : (
              /* Bloqueado — evento ainda é rascunho */
              <div className="flex items-center gap-4 w-full">
                <div
                  className="w-[116px] h-[116px] rounded-xl shrink-0 flex items-center justify-center"
                  style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
                  <Lock size={28} className="text-[#2a2a2a]" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[#444] text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Divulgação bloqueada
                  </p>
                  <p className="text-[#2e2e2e] text-xs leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    O QR code, o link e o compartilhamento via WhatsApp ficam disponíveis assim que você publicar o evento.
                  </p>
                  <a
                    href={`/criar-evento/${evento.id}/publicar`}
                    className="mt-2 text-xs font-medium w-fit flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
                    style={{ background: 'rgba(232,184,75,0.10)', border: '1px solid rgba(232,184,75,0.20)', color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                    Publicar evento →
                  </a>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Conteúdo principal ───────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">

        {/* ── Coluna esquerda ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-10">

          {/* ── Sobre o evento ── */}
          {(currentDesc || isOwner) && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-white text-lg font-medium flex-1"
                    style={{ fontFamily: 'var(--font-outfit)' }}>
                  Sobre o evento
                </h2>
                {isOwner && editField !== 'description' && pencilBtn('description')}
              </div>

              {editField === 'description' ? (
                <div>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    maxLength={1000}
                    rows={6}
                    autoFocus
                    placeholder="Descreva o evento, atrações, regras..."
                    className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 resize-none placeholder:text-[#383838]"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                  <div className="flex items-center justify-between mt-1">
                    {saveCancelBtns(() =>
                      saveField('description', { description: editDesc }, () => setCurrentDesc(editDesc))
                    )}
                    <span className="text-[#333] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {editDesc.length}/1000
                    </span>
                  </div>
                </div>
              ) : currentDesc ? (
                <p className="text-[#888] text-sm leading-relaxed whitespace-pre-line"
                   style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {currentDesc}
                </p>
              ) : (
                <button
                  onClick={() => setEditField('description')}
                  className="flex items-center justify-center gap-2 text-[#444] text-sm hover:text-[#E8B84B] border border-dashed border-[#222] hover:border-[#E8B84B]/30 rounded-xl px-4 py-3 w-full transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  <Pencil size={13} /> Adicionar descrição
                </button>
              )}
            </section>
          )}

          {/* ── Programação ── */}
          {(dias.length > 0 || isOwner) && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-white text-lg font-medium flex-1"
                    style={{ fontFamily: 'var(--font-outfit)' }}>
                  Programação
                </h2>
                {isOwner && (
                  <a
                    href={editFormUrl}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[#444] hover:text-[#E8B84B] hover:bg-[#E8B84B]/10 transition-all"
                    title="Editar programação">
                    <Pencil size={12} />
                  </a>
                )}
              </div>

              {dias.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {dias.map((dia, i) => (
                    <div key={dia.id} className="rounded-xl border border-[#1a1a1a] overflow-hidden">
                      {/* Cabeçalho do dia */}
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

                      {/* Atrações */}
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
              ) : (
                <a
                  href={editFormUrl}
                  className="flex items-center justify-center gap-2 text-[#444] text-sm hover:text-[#E8B84B] border border-dashed border-[#222] hover:border-[#E8B84B]/30 rounded-xl px-4 py-3 w-full transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  <Pencil size={13} /> Adicionar programação
                </a>
              )}
            </section>
          )}

          {/* ── Local ── */}
          {(evento.venueName || evento.street || isOwner) && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-white text-lg font-medium flex-1"
                    style={{ fontFamily: 'var(--font-outfit)' }}>
                  Local
                </h2>
                {isOwner && (
                  <a
                    href={editFormUrl}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[#444] hover:text-[#E8B84B] hover:bg-[#E8B84B]/10 transition-all"
                    title="Editar local">
                    <Pencil size={12} />
                  </a>
                )}
              </div>

              {(evento.venueName || evento.street) ? (
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
              ) : (
                <a
                  href={editFormUrl}
                  className="flex items-center justify-center gap-2 text-[#444] text-sm hover:text-[#E8B84B] border border-dashed border-[#222] hover:border-[#E8B84B]/30 rounded-xl px-4 py-3 w-full transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  <Pencil size={13} /> Adicionar local
                </a>
              )}
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
                              onQty={q => setQty(t.id, q, t.quantity)} displayPrice={effectivePrice(t.price)} />
                          ))}
                        </div>
                      )
                    })}
                    {ingressosPacote.map(t => (
                      <TicketRow key={t.id} ingresso={t}
                        qty={selection[t.id] ?? 0}
                        onQty={q => setQty(t.id, q, t.quantity)} displayPrice={effectivePrice(t.price)} />
                    ))}
                  </>
                )}

                {/* ── Modo pacote ───────────────────────────────────────── */}
                {evento.ticketMode === 'pacote' && (
                  <div className="flex flex-col gap-1">
                    {ingressosPacote.map(t => (
                      <TicketRow key={t.id} ingresso={t}
                        qty={selection[t.id] ?? 0}
                        onQty={q => setQty(t.id, q, t.quantity)} displayPrice={effectivePrice(t.price)} />
                    ))}
                  </div>
                )}

                {/* ── Modo ambos ────────────────────────────────────────── */}
                {evento.ticketMode === 'ambos' && (
                  <>
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
                            onQty={q => setQty(t.id, q, t.quantity)} displayPrice={effectivePrice(t.price)} />
                        ))}
                      </div>
                    )}

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
                                  onQty={q => setQty(t.id, q, t.quantity)} displayPrice={effectivePrice(t.price)} />
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

                {/* Total + botões */}
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

                    {/* Formulário de cartão inline */}
                    {showCardForm && (
                      <CheckoutCardPanel
                        eventoId={evento.id}
                        items={getItems()}
                        total={total}
                        onClose={() => setShowCardForm(false)}
                      />
                    )}

                    {!showCardForm && (
                      <>
                        {/* Botão PIX */}
                        <button
                          onClick={handlePixCheckout}
                          disabled={loadingPix || totalItems === 0}
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

                        {/* Botão Cartão de Crédito */}
                        <button
                          onClick={() => { setCheckoutError(null); setShowCardForm(true) }}
                          disabled={loadingPix || totalItems === 0}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
                          style={{
                            background:  'transparent',
                            color:       totalItems > 0 ? ACCENT : '#333',
                            border:      `1px solid ${totalItems > 0 ? ACCENT + '40' : '#1a1a1a'}`,
                            fontFamily:  'var(--font-dm-sans)',
                          }}>
                          Cartão de crédito
                        </button>
                      </>
                    )}
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
