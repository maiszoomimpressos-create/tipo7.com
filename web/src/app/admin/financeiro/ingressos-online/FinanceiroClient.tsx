'use client'

import { useState } from 'react'
import { Check, Loader2, DollarSign, Percent } from 'lucide-react'
import { TaxaPadraoCard, TaxaMinimaCard, type ExtraFeeState, type FeeValueState } from '@/components/admin/TaxaCards'
import { apiFetchAuth } from '@/lib/apiFetch'

const ACCENT = '#E8B84B'

interface Props {
  defaultFeePct:    number
  defaultFeeType:   'fixed' | 'percent'
  minFeePct:        number
  extraFee1:        ExtraFeeState
  extraFee2:        ExtraFeeState
  feePixPct:        number
  feeCredito1xPct:  number
  feeCredito6xPct:  number
  feeCredito12xPct: number
  totalConectados:  number
  mediaFee:         number
}

export function FinanceiroClient({
  defaultFeePct, defaultFeeType, minFeePct, extraFee1, extraFee2,
  feePixPct, feeCredito1xPct, feeCredito6xPct, feeCredito12xPct,
  totalConectados, mediaFee,
}: Props) {
  const [fee,           setFee]           = useState<FeeValueState>({ value: String(defaultFeePct), type: defaultFeeType })
  const [minFee,        setMinFee]        = useState(String(minFeePct))
  const [extra1,        setExtra1]        = useState<ExtraFeeState>(extraFee1)
  const [extra2,        setExtra2]        = useState<ExtraFeeState>(extraFee2)
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
      await apiFetchAuth('/api/admin/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          default_fee_pct:    parseFloat(fee.value || '0'),
          default_fee_type:   fee.type,
          min_fee_pct:        parseFloat(minFee),
          extra_fee_1_label:  extra1.label,
          extra_fee_1_value:  parseFloat(extra1.value || '0'),
          extra_fee_1_type:   extra1.type,
          extra_fee_2_label:  extra2.label,
          extra_fee_2_value:  parseFloat(extra2.value || '0'),
          extra_fee_2_type:   extra2.type,
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
      await apiFetchAuth('/api/admin/settings', {
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

      {/* Configuração da taxa padrão + taxas específicas */}
      <TaxaPadraoCard
        fee={fee} setFee={setFee}
        extra1={extra1} setExtra1={setExtra1}
        extra2={extra2} setExtra2={setExtra2}
      />

      {/* Taxa mínima mesmo com desconto */}
      <TaxaMinimaCard minFee={minFee} setMinFee={setMinFee} />

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
