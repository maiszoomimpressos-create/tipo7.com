'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Banknote, Smartphone, CreditCard, Ticket,
  TrendingUp, Wallet, ArrowDownUp, RefreshCw, AlertTriangle,
} from 'lucide-react'

interface Stats {
  nome:            string
  fundo_inicial:   number
  totalDinheiro:   number
  totalPix:        number
  totalCartao:     number
  totalVendas:     number
  vendidos:        number
  saldoIngressos:  number
  ingressos_alocados: number
  recebidos:       number
  enviados:        number
  expectedGaveta:  number
}

const ACCENT = '#E8B84B'

function fmt(n: number) {
  return `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

function Linha({ label, value, destaque }: { label: string; value: string; destaque?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</span>
      <span
        className="text-xs font-semibold"
        style={{ color: destaque ? ACCENT : '#888', fontFamily: 'var(--font-dm-sans)' }}
      >
        {value}
      </span>
    </div>
  )
}

export function CaixaSidebar({ caixaId }: { caixaId: string }) {
  const [stats,      setStats]      = useState<Stats | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchStats = useCallback(async () => {
    const res = await fetch(`/api/caixas/${caixaId}`)
    if (!res.ok) return
    const data = await res.json()
    setStats(data)
    setLastUpdate(new Date())
    setLoading(false)
  }, [caixaId])

  // Fetch inicial
  useEffect(() => { fetchStats() }, [fetchStats])

  // Polling a cada 8 segundos
  useEffect(() => {
    const id = setInterval(fetchStats, 8000)
    return () => clearInterval(id)
  }, [fetchStats])

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: '#111' }} />
        ))}
      </div>
    )
  }

  if (!stats) return null

  const saldoBaixo = stats.saldoIngressos <= 5

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[#333] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Resumo do caixa
        </p>
        <button
          type="button"
          onClick={fetchStats}
          className="p-1.5 rounded-lg transition-all hover:brightness-125 active:scale-95 cursor-pointer"
          style={{ background: '#111', border: '1px solid #1a1a1a' }}
        >
          <RefreshCw size={11} className="text-[#444]" />
        </button>
      </div>

      {/* Total arrecadado */}
      <div
        className="px-4 py-4 rounded-2xl"
        style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}22` }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingUp size={11} style={{ color: ACCENT }} />
          <p className="text-[#888] text-[9px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Total arrecadado
          </p>
        </div>
        <p className="text-2xl font-bold" style={{ color: ACCENT, fontFamily: 'var(--font-outfit)' }}>
          {fmt(stats.totalVendas)}
        </p>
        {lastUpdate && (
          <p className="text-[#333] text-[9px] mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        )}
      </div>

      {/* Breakdown por método */}
      <div className="px-4 py-3.5 rounded-2xl flex flex-col gap-2.5" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
        <p className="text-[#333] text-[9px] uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Por método
        </p>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-[#555]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <Banknote size={11} className="text-green-400" /> Dinheiro
          </span>
          <span className="text-green-400 text-xs font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {fmt(stats.totalDinheiro)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-[#555]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <Smartphone size={11} className="text-blue-400" /> PIX
          </span>
          <span className="text-blue-400 text-xs font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {fmt(stats.totalPix)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-[#555]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <CreditCard size={11} className="text-violet-400" /> Cartão
          </span>
          <span className="text-violet-400 text-xs font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {fmt(stats.totalCartao)}
          </span>
        </div>
      </div>

      {/* Gaveta */}
      <div className="px-4 py-3.5 rounded-2xl flex flex-col gap-2.5" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
        <p className="text-[#333] text-[9px] uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Gaveta
        </p>
        <Linha label="Fundo inicial"     value={fmt(Number(stats.fundo_inicial))} />
        <Linha label="+ Vendas dinheiro" value={fmt(stats.totalDinheiro)} />
        <div className="border-t border-[#1a1a1a] pt-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-[#555]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <Wallet size={10} className="text-[#555]" /> Esperado
            </span>
            <span className="text-white text-xs font-bold" style={{ fontFamily: 'var(--font-outfit)' }}>
              {fmt(stats.expectedGaveta)}
            </span>
          </div>
        </div>
      </div>

      {/* Ingressos */}
      <div
        className="px-4 py-3.5 rounded-2xl flex flex-col gap-2.5"
        style={{
          background: saldoBaixo ? 'rgba(248,113,113,0.04)' : '#0d0d0d',
          border: `1px solid ${saldoBaixo ? 'rgba(248,113,113,0.2)' : '#1a1a1a'}`,
        }}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <Ticket size={10} style={{ color: saldoBaixo ? '#f87171' : '#333' }} />
          <p
            className="text-[9px] uppercase tracking-wider"
            style={{ color: saldoBaixo ? '#f87171' : '#333', fontFamily: 'var(--font-dm-sans)' }}
          >
            Ingressos físicos
          </p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#555]" style={{ fontFamily: 'var(--font-dm-sans)' }}>Vendidos</span>
          <span className="text-white text-xs font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {stats.vendidos}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#555]" style={{ fontFamily: 'var(--font-dm-sans)' }}>Em mãos</span>
          <span
            className="text-xs font-bold"
            style={{ color: saldoBaixo ? '#f87171' : '#fff', fontFamily: 'var(--font-dm-sans)' }}
          >
            {stats.saldoIngressos}
            {saldoBaixo && <span className="ml-1 text-[9px]">⚠</span>}
          </span>
        </div>
        {(stats.recebidos > 0 || stats.enviados > 0) && (
          <div className="border-t border-[#1a1a1a] pt-2 flex flex-col gap-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <ArrowDownUp size={9} className="text-[#333]" />
              <p className="text-[9px] uppercase tracking-wider text-[#333]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Transferências
              </p>
            </div>
            {stats.recebidos > 0 && <Linha label="Recebidos" value={`+${stats.recebidos}`} />}
            {stats.enviados  > 0 && <Linha label="Enviados"  value={`-${stats.enviados}`} />}
          </div>
        )}
        {saldoBaixo && (
          <div className="flex items-center gap-1.5 mt-1 text-red-400/70 text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <AlertTriangle size={10} />
            Solicite mais ingressos ao organizador
          </div>
        )}
      </div>

    </div>
  )
}
