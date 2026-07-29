'use client'

const ACCENT = '#E8B84B'

export interface ExtraFeeState {
  label: string
  value: string
  type: 'fixed' | 'percent'
}

function ExtraFeeField({ extra, setExtra }: { extra: ExtraFeeState; setExtra: (v: ExtraFeeState) => void }) {
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
      <div className="flex items-center gap-2">
        <div className="relative w-24">
          <input
            type="number" min="0" step="0.01"
            value={extra.value}
            onChange={e => setExtra({ ...extra, value: e.target.value })}
            className="w-full bg-[#111] border border-[#222] rounded-xl pl-3 pr-8 py-2 text-white text-sm outline-none focus:border-[#E8B84B]/40"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] text-xs">
            {extra.type === 'percent' ? '%' : 'R$'}
          </span>
        </div>
        <div className="flex rounded-xl overflow-hidden border border-[#222] shrink-0">
          <button
            type="button"
            onClick={() => setExtra({ ...extra, type: 'fixed' })}
            className="px-2.5 py-2 text-[11px] transition-colors"
            style={{
              background:  extra.type === 'fixed' ? `${ACCENT}20` : 'transparent',
              color:       extra.type === 'fixed' ? ACCENT : '#555',
              fontFamily:  'var(--font-dm-sans)',
              fontWeight:  extra.type === 'fixed' ? 600 : 400,
            }}
          >
            Fixo
          </button>
          <button
            type="button"
            onClick={() => setExtra({ ...extra, type: 'percent' })}
            className="px-2.5 py-2 text-[11px] border-l border-[#222] transition-colors"
            style={{
              background:  extra.type === 'percent' ? `${ACCENT}20` : 'transparent',
              color:       extra.type === 'percent' ? ACCENT : '#555',
              fontFamily:  'var(--font-dm-sans)',
              fontWeight:  extra.type === 'percent' ? 600 : 400,
            }}
          >
            %
          </button>
        </div>
      </div>
    </div>
  )
}

interface TaxaPadraoCardProps {
  fee:        string
  setFee:     (v: string) => void
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
          <div className="relative w-28">
            <input
              type="number" min="0" max="100" step="0.5"
              value={fee} onChange={e => setFee(e.target.value)}
              className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] text-sm">%</span>
          </div>
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
