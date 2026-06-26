'use client'

import { useState, useMemo } from 'react'
import {
  DollarSign, Ticket, Users, CalendarCheck,
  ChevronDown, ScanLine, ArrowUpRight, ImageIcon,
  Copy, Check, MapPin,
} from 'lucide-react'

const ACCENT = '#E8B84B'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface EventoResumo {
  id:         string
  title:      string
  status:     string
  date_start: string | null
  banner_url: string | null
  category:   string | null
}

export interface TipoIngresso {
  id:       string
  event_id: string
  name:     string
}

export interface Comprador {
  nome:         string
  email:        string
  birth_date:   string | null
  ticket_type:  string
  event_id:     string
  event_title:  string
  status:       string
  validated_at: string | null
  data_compra:  string
}

interface KPIs {
  receita:       number
  vendidos:      number
  checkins:      number
  totalEventos:  number
}

interface Props {
  orgName:       string
  orgCodigo:     string | null
  orgTipo:       'promotora' | 'estabelecimento' | null
  eventos:       EventoResumo[]
  kpis:          KPIs
  tiposIngresso: TipoIngresso[]
  compradores:   Comprador[]
}

// ─── Badge de código ──────────────────────────────────────────────────────────

function CodigoBadge({ codigo, tipo }: { codigo: string; tipo: 'promotora' | 'estabelecimento' }) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    await navigator.clipboard.writeText(codigo)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title="Copiar código"
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all"
      style={{
        background: copiado ? 'rgba(34,197,94,0.08)' : 'rgba(232,184,75,0.08)',
        border:     `1px solid ${copiado ? 'rgba(34,197,94,0.25)' : 'rgba(232,184,75,0.20)'}`,
      }}
    >
      <MapPin size={11} className={copiado ? 'text-green-400' : 'text-[#E8B84B]'} />
      <span
        className="text-xs font-bold tracking-widest"
        style={{ fontFamily: 'var(--font-syne)', color: copiado ? '#22c55e' : '#E8B84B' }}
      >
        {codigo}
      </span>
      {copiado
        ? <Check size={11} className="text-green-400" />
        : <Copy size={11} className="text-[#E8B84B]/50" />
      }
    </button>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function calcIdade(birth: string | null): string {
  if (!birth) return '—'
  const hoje = new Date()
  const nasc = new Date(birth)
  let age = hoje.getFullYear() - nasc.getFullYear()
  if (hoje.getMonth() < nasc.getMonth() || (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) age--
  return `${age} anos`
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  valid:    { label: 'Válido',    color: '#22c55e' },
  used:     { label: 'Utilizado', color: '#E8B84B' },
  cancelled:{ label: 'Cancelado', color: '#ef4444' },
}

const EVENTO_STATUS: Record<string, { label: string; color: string }> = {
  rascunho:  { label: 'Rascunho',  color: '#555' },
  publicado: { label: 'Publicado', color: '#22c55e' },
  encerrado: { label: 'Encerrado', color: '#E8B84B' },
  cancelado: { label: 'Cancelado', color: '#ef4444' },
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, color }: {
  icon:  React.ElementType
  label: string
  value: string
  sub?:  string
  color: string
}) {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-2xl" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
      <div className="flex items-center justify-between">
        <span className="text-[#444] text-xs uppercase tracking-widest" style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-syne)' }}>{value}</p>
      {sub && <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{sub}</p>}
    </div>
  )
}

// ─── Select customizado ───────────────────────────────────────────────────────

function Select({ value, onChange, options, placeholder }: {
  value:       string
  onChange:    (v: string) => void
  options:     { value: string; label: string }[]
  placeholder: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 rounded-xl text-sm outline-none cursor-pointer"
        style={{
          background:  '#0d0d0d',
          border:      `1px solid ${value ? ACCENT + '40' : '#1e1e1e'}`,
          color:       value ? ACCENT : '#555',
          fontFamily:  'var(--font-dm-sans)',
          minWidth:    160,
        }}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: value ? ACCENT : '#555' }} />
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function DashboardClient({ orgName, orgCodigo, orgTipo, eventos, kpis, tiposIngresso, compradores }: Props) {
  const [filtroEvento, setFiltroEvento] = useState('')
  const [filtroTipo,   setFiltroTipo]   = useState('')

  // Opções dos filtros
  const eventoOpts = eventos.map(e => ({ value: e.id, label: e.title }))

  const tipoOpts = useMemo(() => {
    const base = filtroEvento
      ? tiposIngresso.filter(t => t.event_id === filtroEvento)
      : tiposIngresso
    const unique = new Map<string, string>()
    for (const t of base) unique.set(t.name, t.name)
    return Array.from(unique.entries()).map(([v, l]) => ({ value: v, label: l }))
  }, [tiposIngresso, filtroEvento])

  // Compradores filtrados
  const compradoresFiltrados = useMemo(() => {
    return compradores.filter(c => {
      if (filtroEvento && c.event_id !== filtroEvento) return false
      if (filtroTipo   && c.ticket_type !== filtroTipo)   return false
      return true
    })
  }, [compradores, filtroEvento, filtroTipo])

  // KPIs recalculados com filtro
  const kpisFiltrados = useMemo(() => {
    if (!filtroEvento && !filtroTipo) return kpis
    const vendidos = compradoresFiltrados.length
    const checkins = compradoresFiltrados.filter(c => c.status === 'used').length
    return { ...kpis, vendidos, checkins }
  }, [compradoresFiltrados, filtroEvento, filtroTipo, kpis])

  const semDados = eventos.length === 0

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col gap-8">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl text-white font-bold" style={{ fontFamily: 'var(--font-syne)' }}>
            Minha área
          </h1>
          <p className="text-[#444] text-sm mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {orgName}
          </p>
          {orgCodigo && orgTipo && (
            <div className="mt-2">
              <CodigoBadge codigo={orgCodigo} tipo={orgTipo} />
            </div>
          )}
        </div>
        <a
          href="/criar-evento"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#070707]"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
        >
          Meus eventos
          <ArrowUpRight size={14} />
        </a>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={CalendarCheck} label="Eventos"           value={String(kpis.totalEventos)}      color="#a855f7" />
        <KPICard icon={Ticket}        label="Ingressos vendidos" value={String(kpisFiltrados.vendidos)} color={ACCENT}  />
        <KPICard icon={DollarSign}    label="Receita"            value={fmtBRL(kpis.receita)}           color="#22c55e" sub="pedidos aprovados" />
        <KPICard icon={ScanLine}      label="Check-ins"          value={String(kpisFiltrados.checkins)} color="#38bdf8"
          sub={kpisFiltrados.vendidos > 0 ? `${Math.round(kpisFiltrados.checkins / kpisFiltrados.vendidos * 100)}% de ocupação` : undefined}
        />
      </div>

      {semDados ? (
        <div className="text-center py-20">
          <p className="text-[#333] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Nenhum evento criado ainda.{' '}
            <a href="/criar-evento" className="text-[#E8B84B] hover:underline">Criar evento</a>
          </p>
        </div>
      ) : (
        <>
          {/* Lista de eventos */}
          <section className="flex flex-col gap-4">
            <h2 className="text-white text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Seus eventos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {eventos.map(ev => {
                const st = EVENTO_STATUS[ev.status] ?? EVENTO_STATUS.rascunho
                return (
                  <a
                    key={ev.id}
                    href={`/evento/${ev.id}`}
                    className="group flex gap-3 items-center p-3 rounded-2xl transition-all hover:border-[#2a2a2a]"
                    style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
                  >
                    {/* Thumb */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-[#111] flex items-center justify-center">
                      {ev.banner_url
                        ? <img src={ev.banner_url} alt={ev.title} className="w-full h-full object-cover" />
                        : <ImageIcon size={18} className="text-[#2a2a2a]" />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {ev.title}
                      </p>
                      <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {ev.date_start ? fmtData(ev.date_start) : '—'}
                      </p>
                      <span className="text-[10px] font-semibold" style={{ color: st.color, fontFamily: 'var(--font-dm-sans)' }}>
                        {st.label}
                      </span>
                    </div>
                    <ArrowUpRight size={13} className="text-[#333] group-hover:text-[#555] shrink-0 transition-colors" />
                  </a>
                )
              })}
            </div>
          </section>

          {/* Filtros */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-white text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Público
                {compradoresFiltrados.length > 0 && (
                  <span className="ml-2 text-[#444] normal-case font-normal tracking-normal">
                    {compradoresFiltrados.length} {compradoresFiltrados.length === 1 ? 'pessoa' : 'pessoas'}
                  </span>
                )}
              </h2>
              <div className="flex gap-2 flex-wrap">
                <Select
                  value={filtroEvento}
                  onChange={v => { setFiltroEvento(v); setFiltroTipo('') }}
                  options={eventoOpts}
                  placeholder="Todos os eventos"
                />
                <Select
                  value={filtroTipo}
                  onChange={setFiltroTipo}
                  options={tipoOpts}
                  placeholder="Tipo de ingresso"
                />
                {(filtroEvento || filtroTipo) && (
                  <button
                    type="button"
                    onClick={() => { setFiltroEvento(''); setFiltroTipo('') }}
                    className="px-3 py-2 rounded-xl text-xs text-[#444] hover:text-white border border-[#1e1e1e] hover:border-[#333] transition-colors"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Tabela */}
            {compradoresFiltrados.length === 0 ? (
              <div className="flex items-center justify-center py-16 rounded-2xl" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
                <div className="text-center">
                  <Users size={28} className="text-[#222] mx-auto mb-3" />
                  <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {compradores.length === 0 ? 'Nenhuma venda aprovada ainda' : 'Nenhum resultado para os filtros selecionados'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #141414' }}>
                        {['Nome', 'E-mail', 'Ingresso', 'Evento', 'Idade', 'Status', 'Compra'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#444]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {compradoresFiltrados.map((c, i) => {
                        const st = STATUS_LABEL[c.status] ?? STATUS_LABEL.valid
                        return (
                          <tr
                            key={i}
                            style={{ borderBottom: i < compradoresFiltrados.length - 1 ? '1px solid #111' : 'none' }}
                            className="hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-4 py-3 text-white font-medium">{c.nome}</td>
                            <td className="px-4 py-3 text-[#555]">{c.email}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ background: `${ACCENT}15`, color: ACCENT }}>
                                {c.ticket_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[#555] max-w-[160px] truncate">{c.event_title || '—'}</td>
                            <td className="px-4 py-3 text-[#555]">{calcIdade(c.birth_date)}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-semibold" style={{ color: st.color }}>● {st.label}</span>
                            </td>
                            <td className="px-4 py-3 text-[#555] whitespace-nowrap">{fmtData(c.data_compra)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
