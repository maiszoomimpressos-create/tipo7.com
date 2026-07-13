'use client'

import { useState, useRef } from 'react'
import { X } from 'lucide-react'

const ACCENT = '#E8B84B'

interface Cedula {
  valor: number
  label: string
  tipo:  'nota' | 'moeda'
}

const CEDULAS: Cedula[] = [
  { valor: 200,  label: 'R$ 200',  tipo: 'nota'  },
  { valor: 100,  label: 'R$ 100',  tipo: 'nota'  },
  { valor: 50,   label: 'R$ 50',   tipo: 'nota'  },
  { valor: 20,   label: 'R$ 20',   tipo: 'nota'  },
  { valor: 10,   label: 'R$ 10',   tipo: 'nota'  },
  { valor: 5,    label: 'R$ 5',    tipo: 'nota'  },
  { valor: 2,    label: 'R$ 2',    tipo: 'nota'  },
  { valor: 1,    label: 'R$ 1',    tipo: 'moeda' },
  { valor: 0.50, label: 'R$ 0,50', tipo: 'moeda' },
  { valor: 0.25, label: 'R$ 0,25', tipo: 'moeda' },
  { valor: 0.10, label: 'R$ 0,10', tipo: 'moeda' },
  { valor: 0.05, label: 'R$ 0,05', tipo: 'moeda' },
]

type Tab = 'cedulas' | 'calc'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function subtotalStr(denominacao: number, qty: number) {
  const sub = Math.round(denominacao * 100) * qty / 100
  return qty > 0 ? fmt(sub) : ''
}

interface Props {
  label:    string
  valor?:   number
  onChange?: (v: number) => void
  onClose:  () => void
}

export function CalculadoraDinheiro({ label, onChange, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('cedulas')

  /* ── Cédulas ── */
  const [qtds, setQtds] = useState<Record<number, number>>(() => {
    const m: Record<number, number> = {}
    CEDULAS.forEach(c => { m[c.valor] = 0 })
    return m
  })
  // Ref síncrono de qtds — atualizado junto com setQtds, nunca stale
  const qtdsRef = useRef<Record<number, number>>({})
  CEDULAS.forEach(c => { if (!(c.valor in qtdsRef.current)) qtdsRef.current[c.valor] = 0 })

  // Refs diretos para os elementos DOM dos campos Valor — lidos no blur sem tocar em state
  const valEls = useRef<Record<number, HTMLInputElement | null>>({})

  const [focused, setFocused] = useState<string | null>(null)

  const total = CEDULAS.reduce(
    (s, c) => s + Math.round(c.valor * 100) * (qtds[c.valor] ?? 0),
    0,
  ) / 100

  function onQtyChange(denominacao: number, raw: string) {
    const qty = Math.max(0, parseInt(raw) || 0)
    qtdsRef.current[denominacao] = qty       // ref síncrono
    setQtds(prev => ({ ...prev, [denominacao]: qty }))
    // Atualiza o campo Valor diretamente no DOM (só se ele não estiver em foco)
    const el = valEls.current[denominacao]
    if (el && document.activeElement !== el) {
      el.value = subtotalStr(denominacao, qty)
    }
  }

  function onValBlur(denominacao: number) {
    setFocused(null)
    const el = valEls.current[denominacao]
    if (!el) return
    // Lê direto do DOM — nunca stale, independente de re-renders pendentes
    const raw   = el.value.replace(',', '.')
    const val   = parseFloat(raw) || 0
    const qty   = Math.max(0, Math.round(val / denominacao))
    qtdsRef.current[denominacao] = qty
    setQtds(prev => ({ ...prev, [denominacao]: qty }))
    // Reformata o campo para exibir o valor correto após o cálculo
    el.value = subtotalStr(denominacao, qty)
  }

  function limpar() {
    const m: Record<number, number> = {}
    CEDULAS.forEach(c => { m[c.valor] = 0 })
    qtdsRef.current = { ...m }
    setQtds(m)
    // Limpa campos Valor diretamente no DOM
    CEDULAS.forEach(c => { const el = valEls.current[c.valor]; if (el) el.value = '' })
  }

  function salvar() {
    onChange?.(total)
    onClose()
  }

  /* ── Calculadora normal ── */
  const [disp,   setDisp]   = useState('0')
  const [prev,   setPrev]   = useState<number | null>(null)
  const [op,     setOp]     = useState<string | null>(null)
  const [newNum, setNewNum] = useState(true)

  function applyOp(a: number, b: number, o: string): number {
    if (o === '+') return Math.round((a + b) * 100) / 100
    if (o === '-') return Math.round((a - b) * 100) / 100
    if (o === '×') return Math.round(a * b * 100) / 100
    if (o === '÷') return b !== 0 ? Math.round((a / b) * 100) / 100 : 0
    return b
  }

  function calcPress(k: string) {
    const isDigit = '0123456789'.includes(k)
    const isOp    = ['+', '-', '×', '÷'].includes(k)
    if (isDigit) {
      if (newNum) { setDisp(k === '0' ? '0' : k); setNewNum(false) }
      else setDisp(d => d === '0' ? k : d.length < 12 ? d + k : d)
      return
    }
    if (k === ',') {
      if (newNum) { setDisp('0,'); setNewNum(false) }
      else if (!disp.includes(',')) setDisp(d => d + ',')
      return
    }
    if (k === '←') { setDisp(d => d.length > 1 ? d.slice(0, -1) : '0'); return }
    if (k === 'C')  { setDisp('0'); setPrev(null); setOp(null); setNewNum(true); return }
    if (k === '%')  {
      const v = parseFloat(disp.replace(',', '.')) || 0
      setDisp(fmt(v / 100).replace('.', ','))
      setNewNum(true); return
    }
    if (k === '±') {
      setDisp(d => d.startsWith('-') ? d.slice(1) : d === '0' ? '0' : '-' + d)
      return
    }
    if (isOp) {
      const cur = parseFloat(disp.replace(',', '.')) || 0
      if (prev !== null && op && !newNum) {
        const res = applyOp(prev, cur, op)
        setDisp(fmt(res).replace('.', ',')); setPrev(res)
      } else { setPrev(cur) }
      setOp(k); setNewNum(true); return
    }
    if (k === '=') {
      const cur = parseFloat(disp.replace(',', '.')) || 0
      if (prev !== null && op) {
        const res = applyOp(prev, cur, op)
        setDisp(fmt(res).replace('.', ','))
        setPrev(null); setOp(null); setNewNum(true)
      }
    }
  }

  const CALC_KEYS = [
    'C', '←', '%', '÷',
    '7', '8', '9', '×',
    '4', '5', '6', '-',
    '1', '2', '3', '+',
    '±', '0', ',', '=',
  ]

  function inputBase(fKey: string, isAtivo: boolean): React.CSSProperties {
    return {
      background:   '#1c1c1c',
      border:       `1px solid ${focused === fKey ? ACCENT : isAtivo ? ACCENT + '55' : '#333'}`,
      color:        isAtivo ? '#fff' : '#666',
      fontFamily:   'var(--font-dm-sans)',
      outline:      'none',
      borderRadius: '0.5rem',
      height:       '2.25rem',
      fontSize:     '0.875rem',
      fontWeight:   600,
      width:        '100%',
      boxSizing:    'border-box' as const,
      padding:      '0 0.5rem',
      transition:   'border-color 0.15s',
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-t-3xl flex flex-col"
        style={{ background: '#0d0d0d', border: '1px solid #222', maxHeight: '94dvh' }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between shrink-0"
             style={{ borderBottom: '1px solid #222' }}>
          <p className="text-[#999] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
          <div className="flex gap-1 rounded-xl p-1" style={{ background: '#181818', border: '1px solid #2a2a2a' }}>
            {(['cedulas', 'calc'] as Tab[]).map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: tab === t ? ACCENT : 'transparent',
                  color:      tab === t ? '#070707' : '#777',
                  fontFamily: 'var(--font-dm-sans)',
                }}>
                {t === 'cedulas' ? 'Cédulas' : 'Calculadora'}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} className="text-[#666] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* ── ABA CÉDULAS ── */}
        {tab === 'cedulas' && (
          <>
            {/* Total */}
            <div className="px-6 py-4 flex items-center justify-between shrink-0"
                 style={{ borderBottom: '1px solid #1a1a1a' }}>
              <div>
                <p className="text-[#666] text-[10px] uppercase tracking-wider mb-0.5"
                   style={{ fontFamily: 'var(--font-dm-sans)' }}>Total contado</p>
                <p className="font-bold"
                   style={{ fontFamily: 'var(--font-outfit)', fontSize: '2rem', color: total > 0 ? '#fff' : '#444' }}>
                  R$ {fmt(total)}
                </p>
              </div>
              {total > 0 && (
                <button type="button" onClick={limpar}
                  className="text-xs px-3 py-1.5 rounded-xl"
                  style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontFamily: 'var(--font-dm-sans)' }}>
                  Limpar
                </button>
              )}
            </div>

            {/* Cabeçalho colunas */}
            <div className="grid px-4 pt-3 pb-1" style={{ gridTemplateColumns: '1fr 76px 108px' }}>
              <span className="text-[#555] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>Denominação</span>
              <span className="text-[#555] text-[10px] uppercase tracking-wider text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>Qtd</span>
              <span className="text-[#555] text-[10px] uppercase tracking-wider pl-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>Valor (R$)</span>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1 px-4 pb-3 flex flex-col gap-1">

              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-px" style={{ background: '#222' }} />
                <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 10, color: ACCENT + 'aa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Notas de papel</span>
                <div className="flex-1 h-px" style={{ background: '#222' }} />
              </div>

              {CEDULAS.map((c, idx) => {
                const qty     = qtds[c.valor] ?? 0
                const isAtivo = qty > 0
                const isSep   = idx === 7

                return (
                  <div key={c.valor}>
                    {isSep && (
                      <div className="flex items-center gap-2 my-2">
                        <div className="flex-1 h-px" style={{ background: '#222' }} />
                        <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 10, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Moedas</span>
                        <div className="flex-1 h-px" style={{ background: '#222' }} />
                      </div>
                    )}

                    <div
                      className="grid items-center rounded-xl px-3 py-2 gap-2"
                      style={{
                        gridTemplateColumns: '1fr 76px 108px',
                        background: isAtivo ? `${ACCENT}0a` : '#141414',
                        border:     isAtivo ? `1px solid ${ACCENT}30` : '1px solid #1e1e1e',
                      }}
                    >
                      <span className="text-sm font-semibold"
                            style={{ fontFamily: 'var(--font-dm-sans)', color: isAtivo ? '#eee' : '#777' }}>
                        {c.label}
                      </span>

                      {/* Campo Quantidade — controlado, atualiza total em tempo real */}
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        placeholder="0"
                        value={qty === 0 ? '' : qty}
                        onChange={e => onQtyChange(c.valor, e.target.value)}
                        onFocus={() => setFocused(`${c.valor}-qty`)}
                        onBlur={() => setFocused(null)}
                        style={{
                          ...inputBase(`${c.valor}-qty`, isAtivo),
                          textAlign: 'center',
                          color: isAtivo ? ACCENT : '#666',
                        }}
                      />

                      {/* Campo Valor — NÃO controlado: DOM é a fonte de verdade */}
                      <div className="flex items-center gap-1">
                        <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 11, color: '#555', flexShrink: 0 }}>R$</span>
                        <input
                          ref={el => { valEls.current[c.valor] = el }}
                          type="text"
                          inputMode="decimal"
                          placeholder="0,00"
                          defaultValue={subtotalStr(c.valor, qty)}
                          onChange={e => {
                            e.target.value = e.target.value.replace(/[^0-9,.]/g, '')
                          }}
                          onFocus={() => setFocused(`${c.valor}-val`)}
                          onBlur={() => onValBlur(c.valor)}
                          style={inputBase(`${c.valor}-val`, isAtivo)}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Salvar */}
            <div className="px-4 pb-8 pt-3 shrink-0" style={{ borderTop: '1px solid #1a1a1a' }}>
              {onChange ? (
                <button type="button" onClick={salvar}
                  className="w-full py-4 rounded-2xl text-base font-bold text-[#070707] hover:brightness-110 active:scale-[0.98] transition-all"
                  style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                  Salvar — R$ {fmt(total)}
                </button>
              ) : (
                <div className="w-full py-4 rounded-2xl text-base font-bold text-center"
                  style={{ background: '#141414', border: `1px solid ${ACCENT}25`, color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                  Total no caixa: R$ {fmt(total)}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── ABA CALCULADORA ── */}
        {tab === 'calc' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="px-6 py-6 text-right shrink-0" style={{ borderBottom: '1px solid #1a1a1a' }}>
              {op && prev !== null && (
                <p className="text-[#555] text-sm mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {fmt(prev).replace('.', ',')} {op}
                </p>
              )}
              <p className="font-bold truncate"
                 style={{ fontFamily: 'var(--font-outfit)', fontSize: '2.8rem', color: '#fff' }}>
                {disp}
              </p>
            </div>
            <div className="px-4 pb-8 pt-4 grid grid-cols-4 gap-2 flex-1">
              {CALC_KEYS.map(k => {
                const isOpKey = ['+', '-', '×', '÷'].includes(k)
                const isEq    = k === '='
                const isClear = k === 'C'
                return (
                  <button key={k} type="button" onClick={() => calcPress(k)}
                    className="rounded-2xl text-lg font-semibold transition-all hover:brightness-125 active:scale-95"
                    style={{
                      background: isEq    ? ACCENT
                                : isClear ? 'rgba(248,113,113,0.1)'
                                : isOpKey ? `${ACCENT}18`
                                :           '#1c1c1c',
                      border:     isEq    ? 'none'
                                : isClear ? '1px solid rgba(248,113,113,0.25)'
                                : isOpKey ? `1px solid ${ACCENT}30`
                                :           '1px solid #2a2a2a',
                      color:      isEq    ? '#070707'
                                : isClear ? '#f87171'
                                : isOpKey ? ACCENT
                                : k === '←' ? '#999'
                                :           '#ddd',
                      fontFamily: 'var(--font-dm-sans)',
                      minHeight:  '3.25rem',
                    }}>
                    {k}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
