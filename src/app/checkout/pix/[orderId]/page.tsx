'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Copy, Check, Clock, Loader2, CheckCircle2, XCircle, Ticket } from 'lucide-react'

type OrderStatus = 'pending' | 'in_process' | 'approved' | 'rejected' | 'cancelled'

interface PixData {
  status:       OrderStatus
  total:        number
  qrCode:       string | null
  qrCodeBase64: string | null
  expiresAt:    string | null
}

function formatPrice(n: number) {
  return `R$ ${n.toFixed(2).replace('.', ',')}`
}

function useCountdown(expiresAt: string | null) {
  const [secs, setSecs] = useState<number | null>(null)

  useEffect(() => {
    if (!expiresAt) return
    const target = new Date(expiresAt).getTime()
    function tick() {
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000))
      setSecs(diff)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  if (secs === null) return null
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function PixPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router      = useRouter()

  const [data,    setData]    = useState<PixData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const countdown = useCountdown(data?.expiresAt ?? null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/checkout/pix/status/${orderId}`)
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Erro ao carregar pedido')
        return
      }
      const d: PixData = await res.json()
      setData(d)

      if (d.status === 'approved') {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setTimeout(() => router.push('/meus-ingressos'), 3500)
      }
      if (d.status === 'rejected' || d.status === 'cancelled') {
        if (pollingRef.current) clearInterval(pollingRef.current)
      }
      // Para o polling se o PIX expirou (evita chamadas desnecessárias)
      if (d.expiresAt && new Date(d.expiresAt) < new Date()) {
        if (pollingRef.current) clearInterval(pollingRef.current)
      }
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }, [orderId, router])

  useEffect(() => {
    fetchStatus()
    pollingRef.current = setInterval(fetchStatus, 4000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [fetchStatus])

  async function copyCode() {
    if (!data?.qrCode) return
    await navigator.clipboard.writeText(data.qrCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const isExpired   = !!data?.expiresAt && new Date(data.expiresAt) < new Date() && data?.status !== 'approved'
  const isApproved  = data?.status === 'approved'
  const isRejected  = data?.status === 'rejected' || data?.status === 'cancelled'
  const isPending   = !isApproved && !isRejected && !isExpired

  return (
    <div className="min-h-screen bg-[#070707] flex flex-col items-center justify-center px-4 py-12">

      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <Ticket size={20} style={{ color: '#E8B84B' }} />
        <span className="text-xl" style={{ fontFamily: 'var(--font-syne)', fontWeight: 700 }}>
          <span className="text-white">tipo</span>
          <span style={{ color: '#E8B84B' }}>7</span>
        </span>
      </div>

      <div className="w-full max-w-sm">

        {/* Loading inicial */}
        {loading && (
          <div className="flex flex-col items-center gap-4 py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: '#E8B84B' }} />
            <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Gerando QR code PIX…
            </p>
          </div>
        )}

        {/* Erro */}
        {error && !loading && (
          <div className="text-center py-12">
            <XCircle size={40} className="mx-auto mb-3 text-red-400" />
            <p className="text-white text-sm mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>{error}</p>
            <a href="/" className="text-[#E8B84B] text-xs underline underline-offset-2">
              Voltar ao início
            </a>
          </div>
        )}

        {/* Pagamento aprovado */}
        {isApproved && !loading && (
          <div className="text-center py-10 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-400" />
            </div>
            <div>
              <p className="text-white text-lg font-semibold mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
                Pagamento confirmado!
              </p>
              <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Redirecionando para seus ingressos…
              </p>
            </div>
            <div className="w-6 h-6">
              <Loader2 size={20} className="animate-spin text-[#E8B84B]" />
            </div>
          </div>
        )}

        {/* PIX expirado */}
        {isExpired && !loading && (
          <div className="text-center py-10 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
              <Clock size={32} className="text-yellow-400" />
            </div>
            <div>
              <p className="text-white text-base font-semibold mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
                PIX expirado
              </p>
              <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                O tempo para pagamento encerrou. Volte ao evento e tente novamente.
              </p>
            </div>
            <a
              href="/"
              className="mt-2 text-sm font-semibold px-5 py-2.5 rounded-xl"
              style={{ background: '#E8B84B', color: '#070707', fontFamily: 'var(--font-dm-sans)' }}>
              Voltar ao início
            </a>
          </div>
        )}

        {/* Pagamento rejeitado */}
        {isRejected && !loading && (
          <div className="text-center py-10 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <XCircle size={32} className="text-red-400" />
            </div>
            <div>
              <p className="text-white text-base font-semibold mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
                Pagamento não aprovado
              </p>
              <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Tente novamente ou escolha outra forma de pagamento.
              </p>
            </div>
            <a
              href="/"
              className="mt-2 text-sm font-semibold px-5 py-2.5 rounded-xl"
              style={{ background: '#E8B84B', color: '#070707', fontFamily: 'var(--font-dm-sans)' }}>
              Voltar ao início
            </a>
          </div>
        )}

        {/* QR code + instruções */}
        {isPending && !loading && data && (
          <div className="flex flex-col gap-5">

            {/* Cabeçalho */}
            <div className="text-center">
              <p className="text-white text-lg font-semibold mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
                Pague com PIX
              </p>
              <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Escaneie o QR code ou copie o código abaixo
              </p>
            </div>

            {/* QR code */}
            {data.qrCodeBase64 ? (
              <div className="bg-white rounded-2xl p-4 flex items-center justify-center mx-auto"
                   style={{ width: 240, height: 240 }}>
                <Image
                  src={`data:image/png;base64,${data.qrCodeBase64}`}
                  alt="QR Code PIX"
                  width={208}
                  height={208}
                  className="rounded"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-60 h-60 mx-auto bg-[#111] rounded-2xl border border-[#1a1a1a] flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-[#333]" />
              </div>
            )}

            {/* Valor + timer */}
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-[#444] text-xs mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>Total</p>
                <p className="text-white text-base font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {formatPrice(Number(data.total))}
                </p>
              </div>
              {countdown !== null && (
                <div className="flex items-center gap-1.5">
                  <Clock size={13} style={{ color: Number(countdown.split(':')[0]) < 5 ? '#ef4444' : '#E8B84B' }} />
                  <span
                    className="text-sm font-mono font-semibold"
                    style={{
                      fontFamily: 'var(--font-dm-sans)',
                      color: Number(countdown.split(':')[0]) < 5 ? '#ef4444' : '#E8B84B',
                    }}>
                    {countdown}
                  </span>
                </div>
              )}
            </div>

            {/* Código copia e cola */}
            {data.qrCode && (
              <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#111]">
                  <p className="text-[#444] text-[11px] font-semibold uppercase tracking-wider"
                     style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    PIX Copia e Cola
                  </p>
                </div>
                <div className="px-4 py-3 flex items-start gap-3">
                  <p className="text-[#555] text-xs leading-relaxed flex-1 break-all select-all"
                     style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {data.qrCode.slice(0, 80)}…
                  </p>
                  <button
                    onClick={copyCode}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background:  copied ? '#22c55e20' : '#E8B84B20',
                      color:       copied ? '#4ade80'   : '#E8B84B',
                      border:      `1px solid ${copied ? '#22c55e30' : '#E8B84B30'}`,
                      fontFamily:  'var(--font-dm-sans)',
                    }}>
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}

            {/* Status aguardando */}
            <div className="flex items-center justify-center gap-2 py-2">
              <span className="w-2 h-2 rounded-full bg-[#E8B84B] animate-pulse" />
              <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Aguardando confirmação do pagamento…
              </p>
            </div>

            {/* Instruções */}
            <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
              <p className="text-[#444] text-xs mb-3 font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Como pagar:
              </p>
              <ol className="flex flex-col gap-2">
                {[
                  'Abra o app do seu banco',
                  'Acesse Pix → Pagar → Ler QR code',
                  'Aponte a câmera para o código acima',
                  'Confirme o pagamento',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span
                      className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-[#070707] mt-0.5"
                      style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                      {i + 1}
                    </span>
                    <p className="text-[#555] text-xs leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {step}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
