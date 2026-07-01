'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, AlertCircle, Scan, ChevronDown, ChevronUp, Clock, User } from 'lucide-react'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type ScanResult = {
  result:      'valid' | 'already_used' | 'invalid' | 'wrong_event' | 'cancelled' | 'error'
  message:     string
  holderName?: string | null
  ticketName?: string | null
  validatedAt?: string | null
  validatedBy?: string | null
}

type ScanRecord = ScanResult & { token: string; at: Date }

interface Props {
  eventoId:     string
  eventoTitle:  string
  operadorName: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

const RESULT_CONFIG = {
  valid:       { bg: '#16a34a', border: '#4ade80', icon: CheckCircle2, label: 'ENTRADA AUTORIZADA' },
  already_used:{ bg: '#dc2626', border: '#f87171', icon: XCircle,      label: 'JÁ UTILIZADO'       },
  invalid:     { bg: '#dc2626', border: '#f87171', icon: XCircle,      label: 'INVÁLIDO'            },
  wrong_event: { bg: '#dc2626', border: '#f87171', icon: XCircle,      label: 'OUTRO EVENTO'        },
  cancelled:   { bg: '#dc2626', border: '#f87171', icon: XCircle,      label: 'CANCELADO'           },
  error:       { bg: '#b45309', border: '#fbbf24', icon: AlertCircle,  label: 'ERRO'                },
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function ScannerClient({ eventoId, eventoTitle, operadorName }: Props) {
  const scannerRef    = useRef<unknown>(null)
  const processingRef = useRef(false)

  const [result,       setResult]       = useState<ScanResult | null>(null)
  const [history,      setHistory]      = useState<ScanRecord[]>([])
  const [showHistory,  setShowHistory]  = useState(false)
  const [camError,     setCamError]     = useState<string | null>(null)
  const [initialized,  setInitialized]  = useState(false)

  // ── Validação via API ──────────────────────────────────────────────────────

  const handleScan = useCallback(async (token: string) => {
    if (processingRef.current) return
    processingRef.current = true

    try {
      const res  = await fetch('/api/scanner/validate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ qr_token: token, eventoId }),
      })
      const data = await res.json() as ScanResult

      setResult(data)
      setHistory(prev => [{ ...data, token, at: new Date() }, ...prev.slice(0, 49)])

      // Auto-dismiss após 3s (2s para válido)
      setTimeout(() => {
        setResult(null)
        processingRef.current = false
      }, data.result === 'valid' ? 2000 : 3000)

    } catch {
      const err: ScanResult = { result: 'error', message: 'Erro de conexão. Verifique a internet.' }
      setResult(err)
      setTimeout(() => { setResult(null); processingRef.current = false }, 3000)
    }
  }, [eventoId])

  // ── Inicializa câmera (somente no browser) ─────────────────────────────────

  useEffect(() => {
    let scanner: { stop: () => Promise<void> } | null = null

    async function iniciar() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const qr = new Html5Qrcode('qr-reader')
        scanner = qr
        scannerRef.current = qr

        await qr.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
          (decoded) => { handleScan(decoded) },
          () => { /* ignora erros de frame */ }
        )

        setInitialized(true)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.toLowerCase().includes('permission')) {
          setCamError('Permissão de câmera negada. Habilite nas configurações do navegador.')
        } else {
          setCamError('Não foi possível iniciar a câmera.')
        }
      }
    }

    iniciar()

    return () => {
      scanner?.stop().catch(() => {})
    }
  }, [handleScan])

  // ── Resultado atual ────────────────────────────────────────────────────────

  const cfg = result ? RESULT_CONFIG[result.result] : null

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col select-none">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="px-4 py-3 flex items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid #111' }}
      >
        <div>
          <p className="text-white text-sm font-semibold leading-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
            {eventoTitle}
          </p>
          <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {operadorName}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: '#111' }}>
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: initialized ? '#4ade80' : camError ? '#f87171' : '#E8B84B', animation: initialized ? 'pulse 2s infinite' : 'none' }}
          />
          <span className="text-[#555] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {initialized ? 'Ao vivo' : camError ? 'Erro' : 'Iniciando...'}
          </span>
        </div>
      </div>

      {/* ── Viewfinder ─────────────────────────────────────────────────────── */}
      <div className="flex-1 relative flex flex-col items-center justify-center px-4 py-4 gap-4">

        {camError ? (
          <div className="flex flex-col items-center gap-3 text-center max-w-xs">
            <AlertCircle size={40} className="text-red-400" />
            <p className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>{camError}</p>
          </div>
        ) : (
          <>
            {/* Container da câmera — html5-qrcode injeta o vídeo aqui */}
            <div className="relative w-full max-w-sm">
              <div
                id="qr-reader"
                className="w-full rounded-2xl overflow-hidden"
                style={{ background: '#111', minHeight: 300 }}
              />

              {/* Overlay de mira quando sem resultado */}
              {!result && initialized && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className="w-[260px] h-[260px] rounded-2xl"
                    style={{
                      border: '2px solid rgba(232,184,75,0.5)',
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                    }}
                  >
                    {/* Cantos */}
                    {[
                      'top-0 left-0 border-t-2 border-l-2 rounded-tl-xl',
                      'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
                      'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl',
                      'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl',
                    ].map((cls, i) => (
                      <div key={i} className={`absolute w-8 h-8 ${cls}`} style={{ borderColor: '#E8B84B' }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Overlay de resultado */}
              {result && cfg && (
                <div
                  className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-3 p-6 text-center transition-all"
                  style={{ background: `${cfg.bg}ee` }}
                >
                  <cfg.icon size={56} className="text-white" strokeWidth={1.5} />
                  <div>
                    <p className="text-white text-2xl font-black tracking-wider mb-1" style={{ fontFamily: 'var(--font-syne)' }}>
                      {cfg.label}
                    </p>
                    {result.holderName && (
                      <p className="text-white/90 text-lg font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
                        {result.holderName}
                      </p>
                    )}
                    {result.ticketName && (
                      <p className="text-white/70 text-sm mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {result.ticketName}
                      </p>
                    )}
                    {result.validatedAt && (
                      <p className="text-white/60 text-xs mt-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        Usado em {formatDateTime(result.validatedAt)} por {result.validatedBy}
                      </p>
                    )}
                    {!result.holderName && result.result !== 'valid' && (
                      <p className="text-white/70 text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {result.message}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Instrução */}
            {!result && (
              <div className="flex items-center gap-2">
                <Scan size={14} className="text-[#444]" />
                <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Aponte para o QR code do ingresso
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Histórico de leituras ───────────────────────────────────────────── */}
      <div className="shrink-0" style={{ borderTop: '1px solid #111' }}>
        <button
          type="button"
          onClick={() => setShowHistory(h => !h)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-[#444]" />
            <span className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Leituras desta sessão
              {history.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                  style={{ background: '#1a1a1a', color: '#666' }}>
                  {history.length}
                </span>
              )}
            </span>
          </div>
          {showHistory
            ? <ChevronDown size={14} className="text-[#333]" />
            : <ChevronUp   size={14} className="text-[#333]" />
          }
        </button>

        {showHistory && (
          <div className="max-h-56 overflow-y-auto px-3 pb-3 flex flex-col gap-1.5">
            {history.length === 0 ? (
              <p className="text-[#333] text-xs text-center py-4" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Nenhuma leitura ainda.
              </p>
            ) : (
              history.map((rec, i) => {
                const c = RESULT_CONFIG[rec.result]
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
                  >
                    <c.icon size={14} style={{ color: c.border, flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {rec.holderName ?? rec.message}
                      </p>
                      {rec.ticketName && (
                        <p className="text-[#444] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          {rec.ticketName}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span
                        className="text-[9px] font-semibold uppercase"
                        style={{ color: c.border, fontFamily: 'var(--font-dm-sans)' }}
                      >
                        {c.label}
                      </span>
                      <span className="text-[#444] text-[9px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {formatTime(rec.at)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

    </div>
  )
}
