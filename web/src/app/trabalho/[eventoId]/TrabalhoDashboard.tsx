'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Banknote, Smartphone, CreditCard, Ticket,
  RefreshCw, TrendingUp,
} from 'lucide-react'

interface CaixaData {
  id: string
  nome: string
  status: 'aberto' | 'fechado'
  operadorName: string | null
  vendidos: number
  totalDinheiro: number
  totalPix: number
  totalCartao: number
  totalVendas: number
  saldoIngressos: number
  ingressos_alocados: number
}

const ACCENT = '#E8B84B'

function fmt(n: number) {
  return `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

export function TrabalhoDashboard({ eventoId }: { eventoId: string }) {
  const [caixas, setCaixas] = useState<CaixaData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [pulseId, setPulseId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/eventos/${eventoId}/caixas`, { cache: 'no-store' })
    if (!res.ok) {
      console.error('[Dashboard] API erro', res.status, await res.text().catch(() => ''))
      setLoading(false)
      return
    }
    const json = await res.json()
    console.log('[Dashboard] caixas recebidos:', json.caixas?.length ?? 0)
    setCaixas(json.caixas ?? [])
    setLastUpdate(new Date())
    setLoading(false)
  }, [eventoId])

  useEffect(() => {
    fetchData()

    // Polling a cada 30s como fallback ao Realtime
    const poll = setInterval(fetchData, 30_000)

    const supabase = createClient()

    const channel = supabase
      .channel(`dash-${eventoId}-${Date.now()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders',
        filter: `event_id=eq.${eventoId}`,
      }, (payload) => {
        const caixaId = (payload.new as { caixa_id?: string })?.caixa_id
        if (caixaId) {
          setPulseId(caixaId)
          setTimeout(() => setPulseId(null), 1500)
        }
        fetchData()
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'caixas',
        filter: `evento_id=eq.${eventoId}`,
      }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [eventoId, fetchData])

  const totalVendas    = caixas.reduce((s, c) => s + c.totalVendas, 0)
  const totalDinheiro  = caixas.reduce((s, c) => s + c.totalDinheiro, 0)
  const totalPix       = caixas.reduce((s, c) => s + c.totalPix, 0)
  const totalCartao    = caixas.reduce((s, c) => s + c.totalCartao, 0)
  const totalIngressos = caixas.reduce((s, c) => s + c.vendidos, 0)
  const caixasAbertos  = caixas.filter(c => c.status === 'aberto').length

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: '#111' }} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-white text-base font-semibold"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            Dashboard ao vivo
          </h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[#444] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {caixasAbertos} caixa{caixasAbertos !== 1 ? 's' : ''} aberto{caixasAbertos !== 1 ? 's' : ''}
              {lastUpdate && ` · ${lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
            </span>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-xl transition-all hover:brightness-125 active:scale-95 cursor-pointer"
          style={{ background: '#111', border: '1px solid #1a1a1a' }}
        >
          <RefreshCw size={13} className="text-[#555]" />
        </button>
      </div>

      {/* Resumo geral */}
      <div
        className="px-5 py-4 rounded-2xl"
        style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}22` }}
      >
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={13} style={{ color: ACCENT }} />
          <p className="text-[#888] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Total arrecadado
          </p>
        </div>
        <p className="text-3xl font-bold mb-3" style={{ color: ACCENT, fontFamily: 'var(--font-outfit)' }}>
          {fmt(totalVendas)}
        </p>
        <div className="flex gap-5">
          <span className="text-[#666] text-xs flex items-center gap-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <Banknote size={11} className="text-green-400" />
            {fmt(totalDinheiro)}
          </span>
          <span className="text-[#666] text-xs flex items-center gap-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <Smartphone size={11} className="text-blue-400" />
            {fmt(totalPix)}
          </span>
          <span className="text-[#666] text-xs flex items-center gap-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <CreditCard size={11} className="text-violet-400" />
            {fmt(totalCartao)}
          </span>
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="px-4 py-3 rounded-xl" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
          <p className="text-[#555] text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Ingressos vendidos
          </p>
          <p className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-outfit)' }}>
            {totalIngressos}
          </p>
        </div>
        <div className="px-4 py-3 rounded-xl" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
          <p className="text-[#555] text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Caixas ativos
          </p>
          <p className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-outfit)' }}>
            {caixasAbertos}
            <span className="text-[#333] text-base font-normal ml-1">/ {caixas.length}</span>
          </p>
        </div>
      </div>

      {/* Por caixa */}
      {caixas.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-14 rounded-2xl text-center"
          style={{ border: '1px solid #1a1a1a', background: '#0a0a0a' }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
            <Ticket size={20} className="text-[#333]" />
          </div>
          <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Nenhum caixa aberto ainda.
          </p>
          <p className="text-[#333] text-xs mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Acesse Bilheteria para abrir os caixas.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[#333] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Por caixa
          </p>
          {caixas.map(caixa => {
            const isAberto  = caixa.status === 'aberto'
            const isPulsing = pulseId === caixa.id
            return (
              <div
                key={caixa.id}
                className="px-4 py-4 rounded-2xl transition-all duration-500"
                style={{
                  background: isPulsing ? `${ACCENT}06` : '#0d0d0d',
                  border:     `1px solid ${isPulsing ? ACCENT + '30' : isAberto ? '#1e2d1e' : '#1a1a1a'}`,
                }}
              >
                {/* Header do caixa */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full transition-colors"
                        style={{ background: isAberto ? '#4ade80' : '#333' }}
                      />
                      <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {caixa.nome}
                      </p>
                    </div>
                    {caixa.operadorName && (
                      <p className="text-[#444] text-xs ml-3.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {caixa.operadorName}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: isAberto ? '#4ade8012' : '#1a1a1a',
                      color:      isAberto ? '#4ade80' : '#444',
                      border:     `1px solid ${isAberto ? '#4ade8025' : '#222'}`,
                      fontFamily: 'var(--font-dm-sans)',
                    }}
                  >
                    {isAberto ? 'Aberto' : 'Fechado'}
                  </span>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Receita
                  </span>
                  <span className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-outfit)' }}>
                    {fmt(caixa.totalVendas)}
                  </span>
                </div>

                {/* Breakdown por método */}
                <div
                  className="grid grid-cols-3 gap-2 pt-3"
                  style={{ borderTop: '1px solid #1a1a1a' }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Banknote size={12} className="text-green-400" />
                    <span className="text-green-400 text-[11px] font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {fmt(caixa.totalDinheiro)}
                    </span>
                    <span className="text-[#333] text-[9px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>dinheiro</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Smartphone size={12} className="text-blue-400" />
                    <span className="text-blue-400 text-[11px] font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {fmt(caixa.totalPix)}
                    </span>
                    <span className="text-[#333] text-[9px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>PIX</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <CreditCard size={12} className="text-violet-400" />
                    <span className="text-violet-400 text-[11px] font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {fmt(caixa.totalCartao)}
                    </span>
                    <span className="text-[#333] text-[9px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>cartão</span>
                  </div>
                </div>

                {/* Ingressos */}
                <div
                  className="flex items-center justify-between mt-3 pt-2"
                  style={{ borderTop: '1px solid #1a1a1a' }}
                >
                  <span className="text-[#333] text-[10px] flex items-center gap-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    <Ticket size={10} />
                    {caixa.vendidos} vendido{caixa.vendidos !== 1 ? 's' : ''}
                  </span>
                  <span className="text-[#333] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {caixa.saldoIngressos} em mãos
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
