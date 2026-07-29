'use client'

const ACCENT = '#E8B84B'

export interface FeeValueState {
  value: string
  type: 'fixed' | 'percent'
}

export interface ExtraFeeState extends FeeValueState {
  label: string
}

function FeeTypeToggle({ type, setType }: { type: 'fixed' | 'percent'; setType: (t: 'fixed' | 'percent') => void }) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-[#222] shrink-0">
      <button
        type="button"
        onClick={() => setType('fixed')}
        className="px-2.5 py-2 text-[11px] transition-colors"
        style={{
          background:  type === 'fixed' ? `${ACCENT}20` : 'transparent',
          color:       type === 'fixed' ? ACCENT : '#555',
          fontFamily:  'var(--font-dm-sans)',
          fontWeight:  type === 'fixed' ? 600 : 400,
        }}
      >
        Fixo
      </button>
      <button
        type="button"
        onClick={() => setType('percent')}
        className="px-2.5 py-2 text-[11px] border-l border-[#222] transition-colors"
        style={{
          background:  type === 'percent' ? `${ACCENT}20` : 'transparent',
          color:       type === 'percent' ? ACCENT : '#555',
          fontFamily:  'var(--font-dm-sans)',
          fontWeight:  type === 'percent' ? 600 : 400,
        }}
      >
        %
      </button>
    </div>
  )
}

export function FeeValueField({ fee, setFee, width }: { fee: FeeValueState; setFee: (v: FeeValueState) => void; width?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`relative ${width ?? 'w-24'}`}>
        <input
          type="number" min="0" step="0.01"
          value={fee.value}
          onChange={e => setFee({ ...fee, value: e.target.value })}
          className="w-full bg-[#111] border border-[#222] rounded-xl pl-3 pr-8 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] text-xs">
          {fee.type === 'percent' ? '%' : 'R$'}
        </span>
      </div>
      <FeeTypeToggle type={fee.type} setType={t => setFee({ ...fee, type: t })} />
    </div>
  )
}

export function ExtraFeeField({ extra, setExtra }: { extra: ExtraFeeState; setExtra: (v: ExtraFeeState) => void }) {
  return (
    <div>
      <input
        type="text"
        placeholder="Nome da taxa"
        value={extra.label}
        onChange={e => setExtra({ ...extra, label: e.target.value })}
        className="w-full bg-[#111] border border-[#222] rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-[#E8B84B]/40 mb-2"
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      />
      <FeeValueField fee={extra} setFee={v => setExtra({ ...extra, ...v })} />
    </div>
  )
}

interface TaxaPadraoCardProps {
  fee:        FeeValueState
  setFee:     (v: FeeValueState) => void
  extra1:     ExtraFeeState
  setExtra1:  (v: ExtraFeeState) => void
  extra2:     ExtraFeeState
  setExtra2:  (v: ExtraFeeState) => void
  descricao?: string
}

export function TaxaPadraoCard({ fee, setFee, extra1, setExtra1, extra2, setExtra2, descricao }: TaxaPadraoCardProps) {
  return (
    <div className="rounded-2xl p-6" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
      <p className="text-white text-sm font-medium mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        Taxa padrão da plataforma
      </p>
      <p className="text-[#444] text-xs mb-5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        {descricao ?? 'Aplicada automaticamente para novos promotores que conectarem o Mercado Pago. Não altera taxas já configuradas individualmente.'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div>
          <p className="text-[#666] text-xs mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>Taxa padrão</p>
          <FeeValueField fee={fee} setFee={setFee} width="w-20" />
        </div>

        <div>
          <p className="text-[#666] text-xs mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>Taxa específica 1</p>
          <ExtraFeeField extra={extra1} setExtra={setExtra1} />
        </div>

        <div>
          <p className="text-[#666] text-xs mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>Taxa específica 2</p>
          <ExtraFeeField extra={extra2} setExtra={setExtra2} />
        </div>
      </div>
    </div>
  )
}

export function TaxaMinimaCard({ minFee, setMinFee }: { minFee: string; setMinFee: (v: string) => void }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
      <p className="text-white text-sm font-medium mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        Taxa mínima garantida
      </p>
      <p className="text-[#444] text-xs mb-5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        Mesmo com isenção total nas regras abaixo, a Tipo7 nunca cobra menos que este valor.
        Use 0% para isenção total real. Exemplo: 1% garante cobertura mínima dos custos.
        Só se aplica quando a taxa padrão for percentual — taxa fixa já é um valor absoluto.
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
          {parseFloat(minFee || '0') === 0 ? 'Isenção total permitida' : `Mínimo de ${minFee}% sempre cobrado`}
        </p>
      </div>
    </div>
  )
}
