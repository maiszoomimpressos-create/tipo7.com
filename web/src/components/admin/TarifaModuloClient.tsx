'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { TaxaPadraoCard, TaxaMinimaCard, type ExtraFeeState } from './TaxaCards'

const ACCENT = '#E8B84B'

interface Props {
  keyPrefix:      string
  defaultFeePct:  number
  minFeePct:      number
  extraFee1:      ExtraFeeState
  extraFee2:      ExtraFeeState
  descricao?:     string
}

export function TarifaModuloClient({ keyPrefix, defaultFeePct, minFeePct, extraFee1, extraFee2, descricao }: Props) {
  const [fee,    setFee]    = useState(String(defaultFeePct))
  const [minFee, setMinFee] = useState(String(minFeePct))
  const [extra1, setExtra1] = useState<ExtraFeeState>(extraFee1)
  const [extra2, setExtra2] = useState<ExtraFeeState>(extraFee2)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  async function handleSalvar() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/admin/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          [`${keyPrefix}default_fee_pct`]:   parseFloat(fee),
          [`${keyPrefix}min_fee_pct`]:       parseFloat(minFee),
          [`${keyPrefix}extra_fee_1_label`]: extra1.label,
          [`${keyPrefix}extra_fee_1_value`]: parseFloat(extra1.value || '0'),
          [`${keyPrefix}extra_fee_1_type`]:  extra1.type,
          [`${keyPrefix}extra_fee_2_label`]: extra2.label,
          [`${keyPrefix}extra_fee_2_value`]: parseFloat(extra2.value || '0'),
          [`${keyPrefix}extra_fee_2_type`]:  extra2.type,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <TaxaPadraoCard
        fee={fee} setFee={setFee}
        extra1={extra1} setExtra1={setExtra1}
        extra2={extra2} setExtra2={setExtra2}
        descricao={descricao}
      />
      <TaxaMinimaCard minFee={minFee} setMinFee={setMinFee} />

      <div className="flex justify-end">
        <button type="button" onClick={handleSalvar} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-60"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <><Check size={14} /> Salvo!</> : 'Salvar taxas'}
        </button>
      </div>
    </div>
  )
}
