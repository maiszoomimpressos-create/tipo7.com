'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, Loader2, Link2, Unlink, ExternalLink } from 'lucide-react'

const ACCENT = '#E8B84B'

type MPStatus =
  | { connected: false }
  | { connected: true; mpUserId: number; feePct: number; expiresAt: string | null; updatedAt: string }

export function MPConnect() {
  const [status,       setStatus]       = useState<MPStatus | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [desconecting, setDesconecting] = useState(false)

  async function carregar() {
    setLoading(true)
    try {
      const res  = await fetch('/api/mp/status')
      const data = await res.json()
      setStatus(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()

    // Exibe feedback se veio do callback OAuth
    const params = new URLSearchParams(window.location.search)
    if (params.get('mp_connected') === '1') {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  async function handleDesconectar() {
    setDesconecting(true)
    try {
      await fetch('/api/mp/disconnect', { method: 'DELETE' })
      setStatus({ connected: false })
    } finally {
      setDesconecting(false)
    }
  }

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#141414]">
        <div className="flex items-center gap-2">
          <Link2 size={14} style={{ color: ACCENT }} />
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Recebimento de pagamentos
          </p>
        </div>
        <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Conecte sua conta do Mercado Pago para receber as vendas diretamente
        </p>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-[#444]">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>Verificando conexão...</span>
          </div>

        ) : status?.connected ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: '#4ade8008', border: '1px solid #4ade8025' }}>
              <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-green-400 text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Conta Mercado Pago conectada
                </p>
                <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  ID: {status.mpUserId} · Taxa de serviço: {Number(status.feePct).toFixed(0)}%
                </p>
                {status.expiresAt && (
                  <p className="text-[#444] text-[10px] mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Expira em: {new Date(status.expiresAt).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            </div>

            <p className="text-[#444] text-xs leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Os pagamentos serão depositados diretamente na sua conta do Mercado Pago.
              A Tipo7 retém <strong className="text-[#666]">{Number(status.feePct).toFixed(0)}%</strong> de cada venda como taxa de serviço.
            </p>

            <button
              type="button"
              onClick={handleDesconectar}
              disabled={desconecting}
              className="flex items-center gap-1.5 text-[#555] hover:text-red-400 text-xs transition-colors w-fit"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              {desconecting
                ? <Loader2 size={12} className="animate-spin" />
                : <Unlink size={12} />
              }
              Desconectar conta
            </button>
          </div>

        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: '#E8B84B08', border: '1px solid #E8B84B20' }}>
              <AlertCircle size={18} style={{ color: ACCENT }} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Conta não conectada
                </p>
                <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Sem conexão, os pagamentos ficam retidos na plataforma até a integração ser configurada
                </p>
              </div>
            </div>

            <p className="text-[#444] text-xs leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Ao conectar, os compradores pagam normalmente e o valor (menos a taxa de serviço de 10%) cai direto na sua conta do Mercado Pago.
            </p>

            <a
              href="/api/mp/auth"
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-[#070707] hover:brightness-110 transition-all w-fit"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
            >
              <ExternalLink size={14} />
              Conectar conta Mercado Pago
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
