'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

const ACCENT  = '#E8B84B'
const CEDULAS = [0.05, 0.10, 0.25, 0.50, 1, 2, 5, 10, 20, 50, 100, 200]

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
  label:    string
  valor?:   number
  onChange?: (v: number) => void
  onClose:  () => void
}

export function CalculadoraDinheiro({ label, valor = 0, onChange, onClose }: Props) {
  // Internamente em centavos para evitar problemas de ponto flutuante
  const [centavos, setCentavos] = useState<number>(Math.round(valor * 100))
  const [digitando, setDigitando] = useState(false)
  const [digitStr,  setDigitStr]  = useState('')

  const total = digitando ? (parseInt(digitStr || '0') / 100) : (centavos / 100)

  function addCedula(n: number) {
    setDigitando(false)
    setDigitStr('')
    setCentavos(c => c + Math.round(n * 100))
  }

  function pressKey(k: string) {
    if (k === 'C') {
      setCentavos(0); setDigitando(false); setDigitStr(''); return
    }
    if (k === '←') {
      if (digitando) {
        const s = digitStr.slice(0, -1)
        setDigitStr(s)
        if (!s) setDigitando(false)
      } else {
        setCentavos(0)
      }
      return
    }
    // Entrada estilo caixa: dígitos são centavos acumulados (ex: 1,5,0 → R$1,50)
    const s = (digitando ? digitStr : '') + k
    setDigitando(true)
    setDigitStr(s)
  }

  function confirmar() {
    const final = digitando ? Math.round(parseInt(digitStr || '0')) : centavos
    onChange?.(final / 100)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.88)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-t-3xl flex flex-col overflow-y-auto"
        style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', maxHeight: '92dvh' }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between shrink-0"
             style={{ borderBottom: '1px solid #1a1a1a' }}>
          <p className="text-[#888] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
          <button type="button" onClick={onClose} className="text-[#555] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Display */}
        <div className="px-6 py-6 text-center shrink-0">
          <p className="text-[#444] text-xs mb-2 uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Total
          </p>
          <p className="font-bold leading-none"
             style={{ fontFamily: 'var(--font-outfit)', fontSize: '3rem', color: total > 0 ? '#fff' : '#333' }}>
            R$ {fmt(total)}
          </p>
        </div>

        {/* Cédulas e moedas */}
        <div className="px-4 pb-4 shrink-0">
          <p className="text-[#333] text-[10px] uppercase tracking-wider mb-3 px-0.5"
             style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Toque para adicionar
          </p>
          <div className="flex flex-wrap gap-2">
            {CEDULAS.map(n => (
              <button key={n} type="button" onClick={() => addCedula(n)}
                className="rounded-xl text-xs font-bold transition-all hover:brightness-125 active:scale-95"
                style={{
                  padding: '8px 14px',
                  background: n >= 5 ? `${ACCENT}15` : '#1a1a1a',
                  border:     n >= 5 ? `1px solid ${ACCENT}35` : '1px solid #252525',
                  color:      n >= 5 ? ACCENT : '#bbb',
                  fontFamily: 'var(--font-dm-sans)',
                  minWidth: '52px',
                }}>
                {n < 1 ? `${Math.round(n * 100)}¢` : `R$${n}`}
              </button>
            ))}
          </div>
        </div>

        {/* Numpad */}
        <div className="px-4 pb-3 grid grid-cols-3 gap-2 shrink-0">
          {['1','2','3','4','5','6','7','8','9','C','0','←'].map(k => (
            <button key={k} type="button" onClick={() => pressKey(k)}
              className="py-4 rounded-2xl text-lg font-semibold transition-all hover:brightness-125 active:scale-95"
              style={{
                background: k === 'C' ? 'rgba(248,113,113,0.08)' : '#1a1a1a',
                border:     k === 'C' ? '1px solid rgba(248,113,113,0.2)' : '1px solid #252525',
                color:      k === 'C' ? '#f87171' : k === '←' ? '#888' : '#ddd',
                fontFamily: 'var(--font-dm-sans)',
              }}>
              {k}
            </button>
          ))}
        </div>

        {/* Confirmar */}
        <div className="px-4 pb-8 pt-1 shrink-0">
          <button type="button" onClick={confirmar}
            className="w-full py-4 rounded-2xl text-base font-bold text-[#070707] hover:brightness-110 active:scale-[0.98] transition-all"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
            Confirmar — R$ {fmt(total)}
          </button>
        </div>
      </div>
    </div>
  )
}
