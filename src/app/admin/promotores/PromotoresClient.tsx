'use client'

import { useState } from 'react'
import { Check, Loader2, Wifi, WifiOff, Pencil, X } from 'lucide-react'

const ACCENT = '#E8B84B'

type Row = {
  userId:      string
  nome:        string
  codigo:      string | null
  tipoPessoa:  string | null
  mpConected:  boolean
  feePct:      number
  totalVendas: number
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function FeeEditor({ row, onSaved }: { row: Row; onSaved: (pct: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(String(row.feePct))
  const [saving,  setSaving]  = useState(false)

  async function save() {
    setSaving(true)
    try {
      await fetch(`/api/admin/promotores/${row.userId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fee_pct: parseFloat(value) }),
      })
      onSaved(parseFloat(value))
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 text-sm group"
        style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
      >
        {row.feePct}%
        <Pencil size={11} className="text-[#444] group-hover:text-white transition-colors" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        max="100"
        step="0.5"
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        className="w-16 bg-[#111] border border-[#333] rounded-lg px-2 py-1 text-white text-sm outline-none focus:border-[#E8B84B]/40"
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      />
      <span className="text-[#555] text-sm">%</span>
      <button type="button" onClick={save} disabled={saving}
        className="w-6 h-6 rounded-lg flex items-center justify-center"
        style={{ background: ACCENT }}>
        {saving ? <Loader2 size={11} className="text-[#070707] animate-spin" /> : <Check size={11} className="text-[#070707]" />}
      </button>
      <button type="button" onClick={() => setEditing(false)}
        className="w-6 h-6 rounded-lg flex items-center justify-center bg-[#1a1a1a]">
        <X size={11} className="text-[#555]" />
      </button>
    </div>
  )
}

export function PromotoresClient({ rows: initial }: { rows: Row[] }) {
  const [rows, setRows] = useState(initial)
  const [search, setSearch] = useState('')

  const filtered = rows.filter(r =>
    r.nome.toLowerCase().includes(search.toLowerCase())
  )

  function updateFee(userId: string, pct: number) {
    setRows(prev => prev.map(r => r.userId === userId ? { ...r, feePct: pct } : r))
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        placeholder="Buscar promotor..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-72 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      />

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a' }}>
              {['Promotor', 'Código', 'Tipo', 'Mercado Pago', 'Taxa', 'Volume vendas'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[#444] text-xs font-medium uppercase tracking-wider"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#333] text-sm"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Nenhum promotor encontrado.
                </td>
              </tr>
            ) : filtered.map((row, i) => (
              <tr key={row.userId} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #111' : 'none', background: '#070707' }}>
                <td className="px-4 py-3">
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>{row.nome}</p>
                </td>
                <td className="px-4 py-3">
                  {row.codigo
                    ? <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(232,184,75,0.10)', color: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>{row.codigo}</span>
                    : <span className="text-[#333] text-sm">—</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full uppercase font-semibold"
                        style={{ background: '#1a1a1a', color: '#555', fontFamily: 'var(--font-dm-sans)' }}>
                    {row.tipoPessoa ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {row.mpConected
                      ? <><Wifi size={12} className="text-green-400" /><span className="text-green-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>Conectado</span></>
                      : <><WifiOff size={12} className="text-[#444]" /><span className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>Não conectado</span></>
                    }
                  </div>
                </td>
                <td className="px-4 py-3">
                  <FeeEditor row={row} onSaved={pct => updateFee(row.userId, pct)} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {fmt(row.totalVendas)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
