'use client'

import { useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import { CheckCircle2, Clock, MapPin, Calendar, Ticket as TicketIcon, Banknote, CreditCard, Loader2 } from 'lucide-react'

const ACCENT = '#E8B84B'

type Estado = 'idle' | 'pix' | 'aguardando' | 'aprovado'

interface PixPayload {
  type:         'pix'
  qrCode:       string | null
  qrCodeBase64: string | null
  total:        number
  ticketName:   string
  quantidade:   number
  expiresAt:    string | null
}

// Dinheiro / Cartão — mesmo tratamento do PIX (mostra valor na segunda tela
// e espera o operador confirmar o recebimento antes de imprimir), só que
// sem QR nem polling: quem "aprova" aqui é o clique do operador, não um
// gateway. `criadoEm` serve só pra descartar payload velho no localStorage
// (aba recarregada horas depois etc.), igual à checagem de expiresAt do PIX.
interface AguardandoPayload {
  type:       'aguardando'
  metodo:     'dinheiro' | 'cartao'
  total:      number
  ticketName: string
  quantidade: number
  criadoEm:   number
}

interface AprovadoPayload {
  type:       'aprovado'
  ticketName: string
  quantidade: number
}

type Payload = PixPayload | AguardandoPayload | AprovadoPayload | { type: 'cancelado' }

interface Slide {
  id:        string
  image_url: string
}

interface EventoCarrossel {
  id:         string
  title:      string
  date_start: string | null
  local:      string | null
  cover_url:  string | null
}

interface Props {
  eventoId:        string
  caixaId:         string
  eventoTitle:     string
  slides:          Slide[]
  eventosProximos: EventoCarrossel[]
}

// Escopado por CAIXA (não evento) desde 09/08/2026 — ver comentário em
// bilheteria-stream.service.ts. localStorage (fallback pra 2 abas no mesmo
// navegador) e o EventSource (SSE entre aparelhos diferentes) usam
// `caixaId` como chave/rota agora, não mais `eventoId`.
export function SegundaTelaClient({ eventoId, caixaId, eventoTitle, slides, eventosProximos }: Props) {
  const [estado,           setEstado]           = useState<Estado>('idle')
  const [pixPayload,       setPixPayload]       = useState<PixPayload | null>(null)
  const [aguardandoPayload, setAguardandoPayload] = useState<AguardandoPayload | null>(null)
  const [aprovadoPayload,  setAprovadoPayload]  = useState<AprovadoPayload | null>(null)
  const [idx,             setIdx]             = useState(0)
  const [horaAtual,       setHoraAtual]       = useState('')
  const [tempoRestante,   setTempoRestante]   = useState<number | null>(null)
  const [fadeKey,         setFadeKey]         = useState(0)

  const usarSlides = slides.length > 0
  const total      = usarSlides ? slides.length : eventosProximos.length

  // Relógio
  useEffect(() => {
    const tick = () =>
      setHoraAtual(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Avanço automático do carrossel
  useEffect(() => {
    if (estado !== 'idle' || total <= 1) return
    const id = setInterval(() => {
      setIdx(i => (i + 1) % total)
      setFadeKey(k => k + 1)
    }, 6000)
    return () => clearInterval(id)
  }, [estado, total])

  // Lê localStorage ao montar — restaura estado atual (pix ou aprovado)
  useEffect(() => {
    const stored = localStorage.getItem(`tipo7-pix-${caixaId}`)
    if (!stored) return
    try {
      const data = JSON.parse(stored)
      if (data.type === 'aprovado') {
        setAprovadoPayload(data as AprovadoPayload)
        setEstado('aprovado')
        setTimeout(() => { setEstado('idle'); setAprovadoPayload(null) }, 8000)
        return
      }
      if (data.type === 'pix') {
        const agora     = Date.now()
        const maxValido = agora + 8 * 60 * 1000  // > 8 min = suspeito (prazo normal é 3 min)
        const expMs     = data.expiresAt ? new Date(data.expiresAt).getTime() : 0
        if (expMs < agora || expMs > maxValido) {
          localStorage.removeItem(`tipo7-pix-${caixaId}`)
        } else {
          setPixPayload(data as PixPayload)
          setEstado('pix')
        }
      }
      if (data.type === 'aguardando') {
        // Sem expiresAt (não é PIX) — usa criadoEm pra descartar payload velho.
        if (!data.criadoEm || Date.now() - data.criadoEm > 8 * 60 * 1000) {
          localStorage.removeItem(`tipo7-pix-${caixaId}`)
        } else {
          setAguardandoPayload(data as AguardandoPayload)
          setEstado('aguardando')
        }
      }
    } catch {
      localStorage.removeItem(`tipo7-pix-${caixaId}`)
    }
  }, [caixaId])

  // ESC na tela de PIX força retorno ao carrossel (escape de emergência)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        localStorage.removeItem(`tipo7-pix-${caixaId}`)
        setEstado('idle')
        setPixPayload(null)
        setAguardandoPayload(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [caixaId])

  // Ouve mudanças no localStorage feitas pela bilheteria (funciona entre janelas)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== `tipo7-pix-${caixaId}`) return
      if (!e.newValue) {
        setEstado('idle')
        setPixPayload(null)
        setAguardandoPayload(null)
        setAprovadoPayload(null)
        return
      }
      try {
        const data = JSON.parse(e.newValue)
        if (data.type === 'pix') {
          // Rejeita PIX já expirado ou com validade suspeita (> 8 min = provável bug)
          const expMs = data.expiresAt ? new Date(data.expiresAt).getTime() : 0
          if (expMs <= Date.now() || expMs > Date.now() + 8 * 60 * 1000) {
            localStorage.removeItem(`tipo7-pix-${caixaId}`)
            return
          }
          setPixPayload(data as PixPayload)
          setEstado('pix')
        } else if (data.type === 'aguardando') {
          if (!data.criadoEm || Date.now() - data.criadoEm > 8 * 60 * 1000) {
            localStorage.removeItem(`tipo7-pix-${caixaId}`)
            return
          }
          setAguardandoPayload(data as AguardandoPayload)
          setEstado('aguardando')
        } else if (data.type === 'aprovado') {
          setAprovadoPayload(data as AprovadoPayload)
          setEstado('aprovado')
          setTimeout(() => { setEstado('idle'); setAprovadoPayload(null) }, 8000)
        }
      } catch {}
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [caixaId])

  // Fase 7.3: SSE (NestJS) — escuta em tempo real os broadcasts da
  // bilheteria, substitui o canal Realtime da Supabase. EventSource
  // reconecta sozinho se a conexão cair (comportamento nativo do browser),
  // então não precisa de lógica extra de retry aqui.
  useEffect(() => {
    const es = new EventSource(`/api/bilheteria/caixa/${caixaId}/stream`)
    es.addEventListener('pix', (e: MessageEvent) => {
      setPixPayload(JSON.parse(e.data) as PixPayload)
      setEstado('pix')
    })
    es.addEventListener('aguardando', (e: MessageEvent) => {
      setAguardandoPayload(JSON.parse(e.data) as AguardandoPayload)
      setEstado('aguardando')
    })
    es.addEventListener('aprovado', (e: MessageEvent) => {
      setAprovadoPayload(JSON.parse(e.data) as AprovadoPayload)
      setEstado('aprovado')
      setTimeout(() => { setEstado('idle'); setAprovadoPayload(null) }, 8000)
    })
    es.addEventListener('cancelado', () => {
      setEstado('idle')
      setPixPayload(null)
    })
    return () => { es.close() }
  }, [caixaId])

  // Countdown do PIX — retorna ao idle automaticamente quando expira
  useEffect(() => {
    if (estado !== 'pix' || !pixPayload?.expiresAt) return
    const calcular = () => {
      const diff = Math.floor((new Date(pixPayload.expiresAt!).getTime() - Date.now()) / 1000)
      if (diff <= 0) {
        setTempoRestante(0)
        localStorage.removeItem(`tipo7-pix-${caixaId}`)
        setEstado('idle')
        setPixPayload(null)
      } else {
        setTempoRestante(diff)
      }
    }
    calcular()
    const id = setInterval(calcular, 1000)
    return () => clearInterval(id)
  }, [estado, pixPayload?.expiresAt, caixaId])

  function formatarTempo(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  // ── Tela PIX ──────────────────────────────────────────────────────────────
  if (estado === 'pix' && pixPayload) {
    return (
      <div className="h-screen w-screen bg-[#070707] flex flex-col items-center justify-center gap-8 overflow-hidden select-none">

        <div className="flex flex-col items-center gap-1">
          <p className="text-xs font-bold uppercase tracking-[0.35em]" style={{ color: ACCENT, fontFamily: 'var(--font-syne)' }}>
            Tipo7.com
          </p>
          <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Escaneie o QR code para pagar
          </p>
        </div>

        {pixPayload.qrCodeBase64 ? (
          <div className="bg-white p-6 rounded-3xl shadow-2xl">
            <img src={`data:image/png;base64,${pixPayload.qrCodeBase64}`} alt="QR PIX" width={280} height={280} />
          </div>
        ) : pixPayload.qrCode ? (
          <div className="bg-white p-6 rounded-3xl shadow-2xl">
            <QRCode value={pixPayload.qrCode} size={280} />
          </div>
        ) : null}

        <div className="text-center flex flex-col gap-1">
          <p className="text-[#555] text-base" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {pixPayload.quantidade}× {pixPayload.ticketName}
          </p>
          <p className="text-6xl font-bold" style={{ color: ACCENT, fontFamily: 'var(--font-outfit)' }}>
            R$ {pixPayload.total.toFixed(2).replace('.', ',')}
          </p>
        </div>

        {tempoRestante !== null && (
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-[#555]" />
            <span className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Expira em {formatarTempo(tempoRestante)}
            </span>
          </div>
        )}

        <p className="text-[#282828] text-xs uppercase tracking-[0.25em]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          PIX • Pagamento instantâneo
        </p>
      </div>
    )
  }

  // ── Tela aguardando (dinheiro/cartão) ───────────────────────────────────────
  // Sem gateway integrado pra nenhum dos dois métodos — quem confirma o
  // recebimento é o operador na tela dele; aqui só exibe o valor pro
  // cliente conferir enquanto isso.
  if (estado === 'aguardando' && aguardandoPayload) {
    const Icone = aguardandoPayload.metodo === 'dinheiro' ? Banknote : CreditCard
    return (
      <div className="h-screen w-screen bg-[#070707] flex flex-col items-center justify-center gap-8 overflow-hidden select-none">

        <div className="flex flex-col items-center gap-1">
          <p className="text-xs font-bold uppercase tracking-[0.35em]" style={{ color: ACCENT, fontFamily: 'var(--font-syne)' }}>
            Tipo7.com
          </p>
          <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {aguardandoPayload.metodo === 'dinheiro' ? 'Pagamento em dinheiro' : 'Pagamento no cartão'}
          </p>
        </div>

        <div
          className="w-44 h-44 rounded-full flex items-center justify-center"
          style={{ background: `${ACCENT}10`, border: `2px solid ${ACCENT}30` }}
        >
          <Icone size={72} style={{ color: ACCENT }} />
        </div>

        <div className="text-center flex flex-col gap-1">
          <p className="text-[#555] text-base" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {aguardandoPayload.quantidade}× {aguardandoPayload.ticketName}
          </p>
          <p className="text-6xl font-bold" style={{ color: ACCENT, fontFamily: 'var(--font-outfit)' }}>
            R$ {aguardandoPayload.total.toFixed(2).replace('.', ',')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-[#555]" />
          <span className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Aguardando confirmação do operador...
          </span>
        </div>
      </div>
    )
  }

  // ── Tela aprovado ─────────────────────────────────────────────────────────
  if (estado === 'aprovado' && aprovadoPayload) {
    return (
      <div
        className="h-screen w-screen flex flex-col items-center justify-center gap-8 overflow-hidden select-none"
        style={{ background: 'radial-gradient(ellipse at center, #0a1f0a 0%, #070707 70%)' }}
      >
        {/* Anel pulsante */}
        <div className="relative flex items-center justify-center">
          <div
            className="absolute rounded-full animate-ping"
            style={{ width: 180, height: 180, background: 'rgba(74,222,128,0.06)' }}
          />
          <div
            className="w-44 h-44 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(74,222,128,0.1)', border: '2px solid rgba(74,222,128,0.3)' }}
          >
            <CheckCircle2 size={88} className="text-green-400" />
          </div>
        </div>

        <div className="text-center flex flex-col gap-4">
          <h1
            className="text-green-400 font-bold"
            style={{ fontFamily: 'var(--font-syne)', fontSize: '3.75rem', lineHeight: 1.1 }}
          >
            Pagamento confirmado!
          </h1>
          <p className="text-white text-2xl font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {aprovadoPayload.quantidade}× {aprovadoPayload.ticketName}
          </p>
          <p className="text-[#555] text-lg mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Obrigado pela sua compra!
          </p>
        </div>

        <p
          className="font-bold uppercase tracking-[0.35em] mt-8"
          style={{ color: ACCENT, fontFamily: 'var(--font-syne)', fontSize: '0.85rem' }}
        >
          Tipo7.com
        </p>
      </div>
    )
  }

  // ── Tela idle — carrossel de imagens do promotor ──────────────────────────
  if (usarSlides) {
    const slide = slides[idx]
    return (
      <div className="h-screen w-screen bg-[#070707] flex flex-col overflow-hidden select-none relative">

        {/* Imagem de fundo full-screen */}
        <img
          key={fadeKey}
          src={slide.image_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.8 }}
        />

        {/* Gradiente inferior */}
        <div
          className="absolute bottom-0 left-0 right-0 h-40"
          style={{ background: 'linear-gradient(to top, rgba(7,7,7,0.95) 0%, transparent 100%)' }}
        />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-12 py-6 shrink-0">
          <p className="text-base font-bold uppercase tracking-[0.35em]" style={{ color: ACCENT, fontFamily: 'var(--font-syne)' }}>
            Tipo7.com
          </p>
          <p className="text-white/50 text-3xl font-bold" style={{ fontFamily: 'var(--font-outfit)' }}>
            {horaAtual}
          </p>
        </div>

        {/* Bottom */}
        <div className="relative z-10 mt-auto flex flex-col items-center gap-4 px-12 py-8 shrink-0">
          {slides.length > 1 && (
            <div className="flex gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setIdx(i); setFadeKey(k => k + 1) }}
                  className="rounded-full transition-all"
                  style={{
                    width:      i === idx ? 20 : 6,
                    height:     6,
                    background: i === idx ? ACCENT : 'rgba(255,255,255,0.2)',
                  }}
                />
              ))}
            </div>
          )}
          <div
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-full"
            style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}15` }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
              Bilheteria aberta
            </span>
          </div>
        </div>
      </div>
    )
  }

  // ── Tela idle — fallback: cards de próximos eventos ───────────────────────
  const eventoAtual = eventosProximos[idx]
  return (
    <div className="h-screen w-screen bg-[#070707] flex flex-col overflow-hidden select-none">

      {/* Top bar */}
      <div className="flex items-center justify-between px-12 py-6 shrink-0">
        <p className="text-base font-bold uppercase tracking-[0.35em]" style={{ color: ACCENT, fontFamily: 'var(--font-syne)' }}>
          Tipo7.com
        </p>
        <p className="text-[#333] text-3xl font-bold" style={{ fontFamily: 'var(--font-outfit)' }}>
          {horaAtual}
        </p>
      </div>

      {/* Carrossel */}
      <div className="flex-1 flex flex-col items-center justify-center px-12 gap-6 overflow-hidden">
        {eventosProximos.length === 0 ? (
          <div className="text-center flex flex-col gap-6">
            <TicketIcon size={56} className="text-[#1a1a1a] mx-auto" />
            <p className="text-[#2a2a2a] text-2xl" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {eventoTitle}
            </p>
          </div>
        ) : (
          <>
            <p className="text-[#2a2a2a] text-xs uppercase tracking-[0.35em] shrink-0" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Próximos eventos
            </p>

            <div
              className="w-full max-w-3xl rounded-3xl overflow-hidden shrink-0"
              style={{ border: '1px solid #111', background: '#0a0a0a' }}
            >
              {eventoAtual?.cover_url ? (
                <div className="h-72 w-full overflow-hidden">
                  <img
                    src={eventoAtual.cover_url}
                    alt={eventoAtual.title}
                    className="w-full h-full object-cover"
                    style={{ opacity: 0.8 }}
                  />
                </div>
              ) : (
                <div
                  className="h-72 w-full flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}12, #0d0d0d)` }}
                >
                  <TicketIcon size={72} style={{ color: `${ACCENT}30` }} />
                </div>
              )}

              <div className="px-10 py-7 flex flex-col gap-3">
                <h2 className="text-white text-4xl font-bold leading-tight" style={{ fontFamily: 'var(--font-syne)' }}>
                  {eventoAtual?.title}
                </h2>
                <div className="flex flex-col gap-2 mt-1">
                  {eventoAtual?.date_start && (
                    <div className="flex items-center gap-2.5">
                      <Calendar size={14} className="text-[#444]" />
                      <span className="text-[#555] text-sm capitalize" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {new Date(eventoAtual.date_start).toLocaleDateString('pt-BR', {
                          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  {eventoAtual?.local && (
                    <div className="flex items-center gap-2.5">
                      <MapPin size={14} className="text-[#444]" />
                      <span className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {eventoAtual.local}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {eventosProximos.length > 1 && (
              <div className="flex gap-2 shrink-0">
                {eventosProximos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIdx(i)}
                    className="rounded-full transition-all"
                    style={{
                      width:      i === idx ? 20 : 6,
                      height:     6,
                      background: i === idx ? ACCENT : '#222',
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom */}
      <div className="flex items-center justify-center px-12 py-6 shrink-0">
        <div
          className="flex items-center gap-2.5 px-5 py-2.5 rounded-full"
          style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}15` }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
            Bilheteria aberta
          </span>
        </div>
      </div>
    </div>
  )
}
