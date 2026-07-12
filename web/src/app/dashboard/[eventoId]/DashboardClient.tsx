'use client'

import { useState, useMemo } from 'react'
import {
  ArrowLeft, Download, TrendingUp, Ticket, CheckCircle2,
  Percent, Search, ChevronUp, ChevronDown, Store,
} from 'lucide-react'

const ACCENT = '#E8B84B'

// ---------------------------------------------------------------------------
// Tipos exportados (usados pelo page.tsx)
// ---------------------------------------------------------------------------

export type DashboardData = {
  evento: {
    id:        string
    title:     string
    dateStart: string | null
  }
  resumo: {
    totalArrecadado:    number
    ingressosVendidos:  number
    checkInsRealizados: number
  }
  vendasPorDia: { date: string; quantidade: number; valor: number }[]
  porTipo: {
    id:       string
    name:     string
    total:    number
    vendidos: number
    valor:    number
    checkIns: number
  }[]
  compradores: {
    orderId:    string
    buyerName:  string
    ticketName: string
    quantity:   number
    unitPrice:  number
    total:      number
    createdAt:  string
    checkIns:   number
  }[]
}

interface Props { data: DashboardData }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatDateFull(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Card de resumo
// ---------------------------------------------------------------------------

function ResumoCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string
  icon: typeof TrendingUp; color: string
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
      <div className="flex items-center justify-between">
        <p className="text-[#555] text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {label}
        </p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={15} style={{ color }} />
        </div>
      </div>
      <div>
        <p className="text-white text-2xl font-bold leading-none" style={{ fontFamily: 'var(--font-syne)' }}>
          {value}
        </p>
        {sub && (
          <p className="text-[#444] text-xs mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>{sub}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gráfico de barras simples (CSS)
// ---------------------------------------------------------------------------

function BarChart({ data }: { data: { date: string; quantidade: number; valor: number }[] }) {
  const [tooltip, setTooltip] = useState<number | null>(null)
  const maxQtd = Math.max(...data.map(d => d.quantidade), 1)

  if (data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center">
        <p className="text-[#333] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Nenhuma venda ainda.
        </p>
      </div>
    )
  }

  // Mostra no máximo 30 barras; se tiver mais, agrupa por semana — mas por simplicidade só mostra os últimos 30
  const visible = data.slice(-30)

  return (
    <div className="relative">
      <div className="flex items-end gap-1 h-40 px-1">
        {visible.map((d, i) => {
          const pct = (d.quantidade / maxQtd) * 100
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center gap-0.5 group cursor-default"
              onMouseEnter={() => setTooltip(i)}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Tooltip */}
              {tooltip === i && (
                <div
                  className="absolute bottom-full mb-2 z-10 px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap pointer-events-none"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', fontFamily: 'var(--font-dm-sans)', color: '#ccc' }}
                >
                  <p className="font-semibold text-white">{formatDate(d.date)}</p>
                  <p>{d.quantidade} ingresso{d.quantidade !== 1 ? 's' : ''}</p>
                  <p style={{ color: ACCENT }}>{moeda(d.valor)}</p>
                </div>
              )}
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height:     `${Math.max(pct, 2)}%`,
                  background: tooltip === i ? '#E8B84B' : '#E8B84B60',
                  minHeight:  4,
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Eixo X — mostra apenas 5 labels */}
      <div className="flex items-end mt-1 px-1">
        {visible.map((d, i) => {
          const step  = Math.floor(visible.length / 4)
          const show  = i === 0 || i === visible.length - 1 || (step > 0 && i % step === 0)
          return (
            <div key={d.date} className="flex-1 text-center">
              {show && (
                <span className="text-[#333] text-[9px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {formatDate(d.date)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exportar CSV
// ---------------------------------------------------------------------------

function exportarCSV(compradores: DashboardData['compradores'], eventoTitle: string) {
  const header = ['Comprador', 'Ingresso', 'Qtd', 'Preço Unit.', 'Total', 'Data', 'Check-ins']
  const rows = compradores.map(c => [
    `"${c.buyerName}"`,
    `"${c.ticketName}"`,
    c.quantity,
    c.unitPrice.toFixed(2),
    c.total.toFixed(2),
    formatDateFull(c.createdAt),
    c.checkIns,
  ])
  const csv = [header, ...rows].map(r => r.join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `vendas-${eventoTitle.toLowerCase().replace(/\s+/g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function DashboardClient({ data }: Props) {
  const { evento, resumo, vendasPorDia, porTipo, compradores } = data

  const [busca,    setBusca]    = useState('')
  const [sortCol,  setSortCol]  = useState<'buyerName' | 'ticketName' | 'total' | 'createdAt' | 'checkIns'>('createdAt')
  const [sortDir,  setSortDir]  = useState<'asc' | 'desc'>('desc')

  const taxaCheckin = resumo.ingressosVendidos > 0
    ? Math.round((resumo.checkInsRealizados / resumo.ingressosVendidos) * 100)
    : 0

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const compradoresFiltrados = useMemo(() => {
    const q = busca.toLowerCase()
    const filtered = compradores.filter(c =>
      !q || c.buyerName.toLowerCase().includes(q) || c.ticketName.toLowerCase().includes(q)
    )
    return [...filtered].sort((a, b) => {
      let va: string | number = a[sortCol]
      let vb: string | number = b[sortCol]
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ?  1 : -1
      return 0
    })
  }, [compradores, busca, sortCol, sortDir])

  function SortIcon({ col }: { col: typeof sortCol }) {
    if (sortCol !== col) return <ChevronUp size={11} className="text-[#333]" />
    return sortDir === 'asc'
      ? <ChevronUp   size={11} style={{ color: ACCENT }} />
      : <ChevronDown size={11} style={{ color: ACCENT }} />
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-8">

      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <a
            href={`/evento/${evento.id}`}
            className="inline-flex items-center gap-1.5 text-[#555] text-xs hover:text-white transition-colors mb-3"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            <ArrowLeft size={13} /> Voltar ao evento
          </a>
          <h1 className="text-white text-2xl leading-tight" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>
            {evento.title}
          </h1>
          {evento.dateStart && (
            <p className="text-[#444] text-sm mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {new Date(evento.dateStart).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/bilheteria/${evento.id}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0 hover:brightness-110 transition-all"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc', fontFamily: 'var(--font-dm-sans)' }}
          >
            <Store size={14} />
            Bilheteria
          </a>
          <button
            type="button"
            onClick={() => exportarCSV(compradores, evento.title)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#070707] shrink-0 hover:brightness-110 transition-all"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
          >
            <Download size={14} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* ── Cards de resumo ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ResumoCard
          label="Arrecadado"
          value={moeda(resumo.totalArrecadado)}
          icon={TrendingUp}
          color={ACCENT}
        />
        <ResumoCard
          label="Vendidos"
          value={String(resumo.ingressosVendidos)}
          sub={`${compradores.length} pedido${compradores.length !== 1 ? 's' : ''}`}
          icon={Ticket}
          color="#818cf8"
        />
        <ResumoCard
          label="Check-ins"
          value={String(resumo.checkInsRealizados)}
          sub={`de ${resumo.ingressosVendidos} vendidos`}
          icon={CheckCircle2}
          color="#4ade80"
        />
        <ResumoCard
          label="Taxa check-in"
          value={`${taxaCheckin}%`}
          icon={Percent}
          color={taxaCheckin >= 80 ? '#4ade80' : taxaCheckin >= 50 ? ACCENT : '#f87171'}
        />
      </div>

      {/* ── Gráfico de vendas por dia ──────────────────────────────────────── */}
      <div className="rounded-2xl p-5" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            Vendas por dia
          </h2>
          <span className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            últimos {Math.min(vendasPorDia.length, 30)} dias com vendas
          </span>
        </div>
        <BarChart data={vendasPorDia} />
      </div>

      {/* ── Por tipo de ingresso ───────────────────────────────────────────── */}
      {porTipo.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
          <h2 className="text-white text-sm font-semibold mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>
            Por tipo de ingresso
          </h2>
          <div className="flex flex-col gap-3">
            {porTipo.map(t => {
              const pct = t.total > 0 ? Math.round((t.vendidos / t.total) * 100) : 0
              return (
                <div key={t.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {t.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {t.vendidos}/{t.total} · {t.checkIns} check-ins
                      </span>
                      <span className="text-sm font-semibold" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                        {moeda(t.valor)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width:      `${pct}%`,
                        background: pct >= 90 ? '#f87171' : pct >= 60 ? ACCENT : '#4ade80',
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Lista de compradores ───────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
        <div className="px-5 py-4 border-b border-[#141414] flex items-center justify-between gap-3">
          <h2 className="text-white text-sm font-semibold shrink-0" style={{ fontFamily: 'var(--font-outfit)' }}>
            Compradores
            <span className="text-[#444] font-normal ml-2 text-xs">{compradoresFiltrados.length}</span>
          </h2>
          <div className="relative max-w-xs w-full">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome ou ingresso..."
              className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg pl-8 pr-3 py-2 text-white text-xs outline-none focus:border-[#E8B84B]/30 placeholder:text-[#333]"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #141414' }}>
                {([
                  { col: 'buyerName',  label: 'Comprador'  },
                  { col: 'ticketName', label: 'Ingresso'   },
                  { col: 'total',      label: 'Total'       },
                  { col: 'createdAt',  label: 'Data'        },
                  { col: 'checkIns',   label: 'Check-in'    },
                ] as { col: typeof sortCol; label: string }[]).map(({ col, label }) => (
                  <th
                    key={col}
                    onClick={() => toggleSort(col)}
                    className="px-4 py-3 text-left cursor-pointer select-none text-[#444] font-medium hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {label} <SortIcon col={col} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compradoresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#333]">
                    Nenhum resultado encontrado.
                  </td>
                </tr>
              ) : (
                compradoresFiltrados.map((c, i) => (
                  <tr
                    key={`${c.orderId}-${i}`}
                    style={{ borderBottom: '1px solid #0f0f0f' }}
                    className="hover:bg-[#111] transition-colors"
                  >
                    <td className="px-4 py-3 text-white">{c.buyerName}</td>
                    <td className="px-4 py-3 text-[#888]">
                      {c.ticketName}
                      {c.quantity > 1 && (
                        <span className="text-[#444] ml-1">×{c.quantity}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: ACCENT }}>
                      {moeda(c.total)}
                    </td>
                    <td className="px-4 py-3 text-[#555]">{formatDateFull(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      {c.checkIns > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ background: '#4ade8015', color: '#4ade80' }}
                        >
                          <CheckCircle2 size={10} /> {c.checkIns}/{c.quantity}
                        </span>
                      ) : (
                        <span className="text-[#333]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </main>
  )
}
