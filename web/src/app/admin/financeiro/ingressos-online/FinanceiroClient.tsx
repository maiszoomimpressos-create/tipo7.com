'use client'

import { useState } from 'react'
import { Check, Loader2, DollarSign, Percent } from 'lucide-react'

const ACCENT = '#E8B84B'

interface Props {
  defaultFeePct:    number
  minFeePct:        number
  feePixPct:        number
  feeCredito1xPct:  number
  feeCredito6xPct:  number
  feeCredito12xPct: number
  totalConectados:  number
  mediaFee:         number
}

export function FinanceiroClient({
  defaultFeePct, minFeePct,
  feePixPct, feeCredito1xPct, feeCredito6xPct, feeCredito12xPct,
  totalConectados, mediaFee,
}: Props) {
  const [fee,           setFee]           = useState(String(defaultFeePct))
  const [minFee,        setMinFee]        = useState(String(minFeePct))
  const [pixPct,        setPixPct]        = useState(String(feePixPct))
  const [cred1xPct,     setCred1xPct]     = useState(String(feeCredito1xPct))
  const [cred6xPct,     setCred6xPct]     = useState(String(feeCredito6xPct))
  const [cred12xPct,    setCred12xPct]    = useState(String(feeCredito12xPct))
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [savingMP,      setSavingMP]      = useState(false)
  const [savedMP,       setSavedMP]       = useState(false)

  async function handleSalvar() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/admin/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          default_fee_pct: parseFloat(fee),
          min_fee_pct:     parseFloat(minFee),
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  async function handleSalvarMP() {
    setSavingMP(true)
    setSavedMP(false)
    try {
      await fetch('/api/admin/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          fee_pct_pix:          parseFloat(pixPct),
          fee_pct_credito_1x:   parseFloat(cred1xPct),
          fee_pct_credito_6x:   parseFloat(cred6xPct),
          fee_pct_credito_12x:  parseFloat(cred12xPct),
        }),
      })
      setSavedMP(true)
      setTimeout(() => setSavedMP(false), 2500)
    } finally {
      setSavingMP(false)
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
              type="number" min="0" max="100" step="0.5"
              value={fee} onChange={e => setFee(e.target.value)}
              className="w-28 bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] text-sm">%</span>
          </div>
        </div>
      </div>

      {/* Taxa mínima mesmo com desconto */}
      <div className="rounded-2xl p-6" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
        <p className="text-white text-sm font-medium mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Taxa mínima garantida
        </p>
        <p className="text-[#444] text-xs mb-5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Mesmo com isenção total nas regras abaixo, a Tipo7 nunca cobra menos que este valor.
          Use 0% para isenção total real. Exemplo: 1% garante cobertura mínima dos custos.
        </p>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="number" min="0" max="100" step="0.5"
              value={minFee} onChange={e => setMinFee(e.target.value)}
              className="w-28 bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] text-sm">%</span>
          </div>
          <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {parseFloat(minFee) === 0 ? 'Isenção total permitida' : `Mínimo de ${minFee}% sempre cobrado`}
          </p>
        </div>
      </div>

      {/* Botão salvar taxas da plataforma */}
      <div className="flex justify-end">
        <button type="button" onClick={handleSalvar} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-60"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <><Check size={14} /> Salvo!</> : 'Salvar taxas da plataforma'}
        </button>
      </div>

      {/* Taxas de processamento Mercado Pago */}
      <div className="rounded-2xl p-6" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
        <p className="text-white text-sm font-medium mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Taxas de processamento — Mercado Pago
        </p>
        <p className="text-[#444] text-xs mb-6" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Cobradas pelo Mercado Pago sobre cada transação. Usadas para calcular o repasse correto ao promotor.
          Consulte sempre a tabela atualizada no painel do Mercado Pago.
        </p>

        <div className="grid grid-cols-2 gap-5">
          {[
            { label: 'PIX',           value: pixPct,     set: setPixPct },
            { label: 'Cartão 1×',     value: cred1xPct,  set: setCred1xPct },
            { label: 'Cartão 2–6×',   value: cred6xPct,  set: setCred6xPct },
            { label: 'Cartão 7–12×',  value: cred12xPct, set: setCred12xPct },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <p className="text-[#666] text-xs mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
              <div className="relative w-32">
                <input
                  type="number" min="0" max="30" step="0.01"
                  value={value} onChange={e => set(e.target.value)}
                  className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] text-sm">%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-6">
          <button type="button" onClick={handleSalvarMP} disabled={savingMP}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-60"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
            {savingMP ? <Loader2 size={14} className="animate-spin" /> : savedMP ? <><Check size={14} /> Salvo!</> : 'Salvar taxas MP'}
          </button>
        </div>
      </div>

    </div>
  )
}
