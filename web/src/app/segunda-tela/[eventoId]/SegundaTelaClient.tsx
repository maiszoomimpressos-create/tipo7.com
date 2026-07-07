'use client'

import { useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import { CheckCircle2, Clock, MapPin, Calendar, Ticket as TicketIcon } from 'lucide-react'

const ACCENT = '#E8B84B'

type Estado = 'idle' | 'pix' | 'aprovado'

interface PixPayload {
  type:         'pix'
  qrCode:       string | null
  qrCodeBase64: string | null
  total:        number
  ticketName:   string
  quantidade:   number
  expiresAt:    string | null
}

interface AprovadoPayload {
  type:       'aprovado'
  ticketName: string
  quantidade: number
}

type Payload = PixPayload | AprovadoPayload | { type: 'cancelado' }

interface EventoCarrossel {
  id:         string
  title:      string
  date_start: string | null
  local:      string | null
  cover_url:  string | null
}

interface Props {
  eventoId:        string
  eventoTitle:     string
  eventosProximos: EventoCarrossel[]
}

export function SegundaTelaClient({ eventoId, eventoTitle, eventosProximos }: Props) {
  const [estado,          setEstado]          = useState<Estado>('idle')
  const [pixPayload,      setPixPayload]      = useState<PixPayload | null>(null)
  const [aprovadoPayload, setAprovadoPayload] = useState<AprovadoPayload | null>(null)
  const [carrosselIdx,    setCarrosselIdx]    = useState(0)
  const [horaAtual,       setHoraAtual]       = useState('')
  const [tempoRestante,   setTempoRestante]   = useState<number | null>(null)

  // Relógio
  useEffect(() => {
    const atualizar = () =>
      setHoraAtual(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    atualizar()
    const id = setInterval(atualizar, 1000)
    return () => clearInterval(id)
  }, [])

  // Avanço automático do carrossel
  useEffect(() => {
    if (estado !== 'idle' || eventosProximos.length <= 1) return
    const id = setInterval(() => setCarrosselIdx(i => (i + 1) % eventosProximos.length), 6000)
    return () => clearInterval(id)
  }, [estado, eventosProximos.length])

  // BroadcastChannel — escuta mensagens da bilheteria
  useEffect(() => {
    const canal = new BroadcastChannel(`tipo7-bilheteria-${eventoId}`)
    canal.onmessage = (e: MessageEvent<Payload>) => {
      const msg = e.data
      if (msg.type === 'pix') {
        setPixPayload(msg)
        setEstado('pix')
      } else if (msg.type === 'aprovado') {
        setAprovadoPayload(msg as AprovadoPayload)
        setEstado('aprovado')
        setTimeout(() => { setEstado('idle'); setAprovadoPayload(null) }, 5000)
      } else if (msg.type === 'cancelado') {
        setEstado('idle')
        setPixPayload(null)
      }
    }
    return () => canal.close()
  }, [eventoId])

  // Countdown do PIX
  useEffect(() => {
    if (estado !== 'pix' || !pixPayload?.expiresAt) return
    const calcular = () => {
      const diff = Math.floor((new Date(pixPayload.expiresAt!).getTime() - Date.now()) / 1000)
      setTempoRestante(diff > 0 ? diff : 0)
    }
    calcular()
    const id = setInterval(calcular, 1000)
    return () => clearInterval(id)
  }, [estado, pixPayload?.expiresAt])

  function formatarTempo(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  const eventoAtual = eventosProximos[carrosselIdx]

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

  // ── Tela aprovado ─────────────────────────────────────────────────────────
  if (estado === 'aprovado' && aprovadoPayload) {
    return (
      <div className="h-screen w-screen bg-[#070707] flex flex-col items-center justify-center gap-6 overflow-hidden select-none">
        <div
          className="w-36 h-36 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(74,222,128,0.08)', border: '2px solid rgba(74,222,128,0.25)' }}
        >
          <CheckCircle2 size={72} className="text-green-400" />
        </div>

        <div className="text-center flex flex-col gap-3">
          <h1 className="text-white text-5xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>
            Pagamento confirmado!
          </h1>
          <p className="text-[#888] text-xl" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {aprovadoPayload.quantidade}× {aprovadoPayload.ticketName}
          </p>
          <p className="text-green-400 text-base mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Obrigado pela compra ✓
          </p>
        </div>

        <p className="text-[#E8B84B] text-sm font-bold uppercase tracking-[0.35em] mt-10" style={{ fontFamily: 'var(--font-syne)' }}>
          Tipo7.com
        </p>
      </div>
    )
  }

  // ── Tela idle — carrossel ─────────────────────────────────────────────────
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
                    onClick={() => setCarrosselIdx(i)}
                    className="rounded-full transition-all"
                    style={{
                      width:      i === carrosselIdx ? 20 : 6,
                      height:     6,
                      background: i === carrosselIdx ? ACCENT : '#222',
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
