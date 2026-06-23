'use client'

import { useState } from 'react'
import { Check, Loader2, DollarSign, Percent } from 'lucide-react'

const ACCENT = '#E8B84B'

interface Props {
  defaultFeePct:   number
  totalConectados: number
  mediaFee:        number
}

export function FinanceiroClient({ defaultFeePct, totalConectados, mediaFee }: Props) {
  const [fee,    setFee]    = useState(String(defaultFeePct))
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  async function handleSalvar() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/admin/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ default_fee_pct: parseFloat(fee) }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={13} style={{ color: ACCENT }} />
            <p className="text-[#555] text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Promotores com MP
            </p>
          </div>
          <p className="text-white text-3xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>
            {totalConectados}
          </p>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
          <div className="flex items-center gap-2 mb-3">
            <Percent size={13} style={{ color: ACCENT }} />
            <p className="text-[#555] text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Média de taxa
            </p>
          </div>
          <p className="text-white text-3xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>
            {mediaFee.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Configuração da taxa padrão */}
      <div className="rounded-2xl p-6" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
        <p className="text-white text-sm font-medium mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Taxa padrão da plataforma
        </p>
        <p className="text-[#444] text-xs mb-5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Aplicada automaticamente para novos promotores que conectarem o Mercado Pago.
          Não altera taxas já configuradas individualmente.
        </p>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={fee}
              onChange={e => setFee(e.target.value)}
              className="w-28 bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] text-sm">%</span>
          </div>

          <button
            type="button"
            onClick={handleSalvar}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-60"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
          >
            {saving
              ? <Loader2 size={14} className="animate-spin" />
              : saved
                ? <><Check size={14} /> Salvo!</>
                : 'Salvar'
            }
          </button>
        </div>
      </div>

    </div>
  )
}
