'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus, Trash2, ArrowLeft, Loader2, AlertTriangle, CheckCircle2,
  ShoppingBag, ArrowRightLeft, Lock, Unlock, Users, TrendingUp,
  Banknote, Smartphone, CreditCard, RefreshCw, ChevronRight,
} from 'lucide-react'

const ACCENT = '#E8B84B'

interface CaixaConfig {
  nome:               string
  fundo_inicial:      number
  ingressos_alocados: number
  operador_id?:       string
}

interface CaixaAberto {
  id:                 string
  nome:               string
  status:             'aberto' | 'fechado'
  operadorName:       string | null
  fundo_inicial:      number
  ingressos_alocados: number
  saldoIngressos:     number
  vendidos:           number
  totalDinheiro:      number
  totalPix:           number
  totalCartao:        number
  totalVendas:        number
}

interface Props {
  eventoId:    string
  eventoTitle: string
  userId:      string
}

export function GerenciadorCaixas({ eventoId, eventoTitle, userId }: Props) {
  const [fase, setFase] = useState<'carregando' | 'semCaixas' | 'configurando' | 'abertos'>('carregando')
  const [pausado, setPausado]     = useState(false)
  const [requerSenha, setRequerSenha] = useState(false)
  const [caixas, setCaixas]       = useState<CaixaAberto[]>([])
  const [configs, setConfigs]     = useState<CaixaConfig[]>([
    { nome: 'Caixa A', fundo_inicial: 0, ingressos_alocados: 0 },
  ])
  const [salvando, setSalvando]   = useState(false)
  const [err, setErr]             = useState<string | null>(null)
  const [pausando, setPausando]   = useState(false)

  const carregarCaixas = useCallback(async () => {
    const res  = await fetch(`/api/eventos/${eventoId}/caixas`)
    if (!res.ok) { setFase('semCaixas'); return }
    const data = await res.json()
    setCaixas(data.caixas ?? [])
    setPausado(data.vendas_online_pausadas ?? false)
    setRequerSenha(data.transferencia_requer_senha ?? false)
    const abertos = (data.caixas ?? []).filter((c: CaixaAberto) => c.status === 'aberto')
    setFase(abertos.length > 0 ? 'abertos' : 'semCaixas')
  }, [eventoId])

  useEffect(() => { carregarCaixas() }, [carregarCaixas])

  async function pausarVendas() {
    setPausando(true)
    await fetch('/api/caixas/pausar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId, pausar: true }),
    })
    setPausado(true)
    setPausando(false)
    setFase('configurando')
  }

  function addCaixa() {
    const letra = String.fromCharCode(65 + configs.length)
    setConfigs(c => [...c, { nome: `Caixa ${letra}`, fundo_inicial: 0, ingressos_alocados: 0 }])
  }

  function removeCaixa(i: number) {
    setConfigs(c => c.filter((_, idx) => idx !== i))
  }

  function updateConfig(i: number, field: keyof CaixaConfig, value: string | number) {
    setConfigs(c => c.map((cfg, idx) => idx === i ? { ...cfg, [field]: value } : cfg))
  }

  async function confirmarAbertura() {
    for (const c of configs) {
      if (!c.nome.trim()) { setErr('Preencha o nome de todos os caixas.'); return }
      if (c.ingressos_alocados < 0) { setErr('Quantidade de ingressos não pode ser negativa.'); return }
    }
    setSalvando(true); setErr(null)
    const res = await fetch('/api/caixas/abrir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId, caixas: configs, transferencia_requer_senha: requerSenha }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error ?? 'Erro ao abrir caixas'); setSalvando(false); return }
    setSalvando(false)
    await carregarCaixas()
  }

  async function retomar() {
    setPausando(true)
    await fetch('/api/caixas/pausar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId, pausar: false }),
    })
    setPausado(false)
    setPausando(false)
  }

  // ── Carregando ────────────────────────────────────────────────────────────
  if (fase === 'carregando') {
    return (
      <div className="min-h-dvh bg-[#070707] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin" style={{ color: ACCENT }} />
      </div>
    )
  }

  // ── Fase: sem caixas abertos ───────────────────────────────────────────────
  if (fase === 'semCaixas') {
    return (
      <div className="min-h-dvh bg-[#070707] flex flex-col">
        <Header eventoTitle={eventoTitle} eventoId={eventoId} />
        <div className="max-w-lg mx-auto w-full px-5 py-12 flex flex-col items-center gap-8 text-center">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
               style={{ background: `${ACCENT}12`, border: `1px solid ${ACCENT}25` }}>
            <ShoppingBag size={32} style={{ color: ACCENT }} />
          </div>
          <div>
            <h2 className="text-white text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-syne)' }}>
              Nenhum caixa aberto
            </h2>
            <p className="text-[#555] text-sm leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Clique abaixo para configurar e abrir os caixas do evento. As vendas online serão pausadas por alguns instantes durante a configuração.
            </p>
          </div>
          <button type="button" onClick={pausarVendas} disabled={pausando}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold text-[#070707] disabled:opacity-50 hover:brightness-110 active:scale-[0.98] transition-all"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
            {pausando ? <><Loader2 size={18} className="animate-spin" /> Pausando vendas...</> : <><ShoppingBag size={18} /> Configurar e abrir caixas</>}
          </button>
        </div>
      </div>
    )
  }

  // ── Fase: configurando caixas ─────────────────────────────────────────────
  if (fase === 'configurando') {
    return (
      <div className="min-h-dvh bg-[#070707] flex flex-col">
        <Header eventoTitle={eventoTitle} eventoId={eventoId} />

        {/* Banner de pausa */}
        <div className="px-6 py-3 flex items-center gap-3"
             style={{ background: 'rgba(232,184,75,0.06)', borderBottom: '1px solid rgba(232,184,75,0.15)' }}>
          <Lock size={14} style={{ color: ACCENT }} />
          <p className="text-[11px]" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
            Vendas online pausadas — configure os caixas e confirme para retomar
          </p>
        </div>

        <div className="max-w-lg mx-auto w-full px-5 py-6 flex flex-col gap-6">

          {/* Controle de transferência */}
          <div className="rounded-2xl p-4 flex items-center justify-between gap-4"
               style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
            <div>
              <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Transferência entre caixas
              </p>
              <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {requerSenha ? 'Requer sua senha para liberar' : 'Operadores podem transferir livremente'}
              </p>
            </div>
            <button type="button" onClick={() => setRequerSenha(v => !v)}
              className="w-12 h-6 rounded-full transition-colors relative shrink-0"
              style={{ background: requerSenha ? ACCENT : '#222' }}>
              <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                   style={{ left: requerSenha ? '26px' : '4px' }} />
            </button>
          </div>

          {/* Lista de caixas */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[#555] text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Caixas a abrir
              </p>
              <button type="button" onClick={addCaixa}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-colors"
                style={{ background: '#111', border: `1px solid ${ACCENT}30`, color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                <Plus size={12} /> Adicionar caixa
              </button>
            </div>

            {configs.map((cfg, i) => (
              <div key={i} className="rounded-2xl p-4 flex flex-col gap-3"
                   style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
                <div className="flex items-center justify-between gap-2">
                  <input
                    value={cfg.nome}
                    onChange={e => updateConfig(i, 'nome', e.target.value)}
                    placeholder="Nome do caixa"
                    className="flex-1 bg-transparent text-white text-sm font-semibold outline-none placeholder:text-[#333]"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                  {configs.length > 1 && (
                    <button type="button" onClick={() => removeCaixa(i)}
                      className="text-[#333] hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#555] text-[10px] uppercase tracking-wider block mb-1.5"
                           style={{ fontFamily: 'var(--font-dm-sans)' }}>Troco inicial (R$)</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={cfg.fundo_inicial}
                      onChange={e => updateConfig(i, 'fundo_inicial', parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    />
                  </div>
                  <div>
                    <label className="text-[#555] text-[10px] uppercase tracking-wider block mb-1.5"
                           style={{ fontFamily: 'var(--font-dm-sans)' }}>Ingressos físicos</label>
                    <input
                      type="number" min="0" step="1"
                      value={cfg.ingressos_alocados}
                      onChange={e => updateConfig(i, 'ingressos_alocados', parseInt(e.target.value) || 0)}
                      className="w-full bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Resumo */}
          <div className="rounded-2xl px-4 py-3 flex items-center justify-between"
               style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}20` }}>
            <span className="text-[#888] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Total de ingressos físicos
            </span>
            <span className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-outfit)', color: ACCENT }}>
              {configs.reduce((s, c) => s + c.ingressos_alocados, 0)}
            </span>
          </div>

          {err && (
            <div className="flex items-center gap-2 text-red-400 text-sm py-3 px-4 rounded-xl bg-red-400/5 border border-red-400/10">
              <AlertTriangle size={14} className="shrink-0" /> {err}
            </div>
          )}

          <button type="button" onClick={confirmarAbertura} disabled={salvando}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold text-[#070707] disabled:opacity-50 hover:brightness-110 active:scale-[0.98] transition-all"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
            {salvando
              ? <><Loader2 size={18} className="animate-spin" /> Abrindo caixas...</>
              : <><CheckCircle2 size={18} /> Confirmar e abrir caixas</>
            }
          </button>

        </div>
      </div>
    )
  }

  // ── Fase: caixas abertos — painel de monitoramento ────────────────────────
  const abertos  = caixas.filter(c => c.status === 'aberto')
  const fechados = caixas.filter(c => c.status === 'fechado')
  const totalGeral = caixas.reduce((s, c) => s + c.totalVendas, 0)
  const totalDinheiro = caixas.reduce((s, c) => s + c.totalDinheiro, 0)
  const totalPix      = caixas.reduce((s, c) => s + c.totalPix, 0)
  const totalCartao   = caixas.reduce((s, c) => s + c.totalCartao, 0)

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col">
      <Header eventoTitle={eventoTitle} eventoId={eventoId} onRefresh={carregarCaixas} />

      {pausado && (
        <div className="px-6 py-3 flex items-center justify-between gap-3"
             style={{ background: 'rgba(232,184,75,0.06)', borderBottom: '1px solid rgba(232,184,75,0.15)' }}>
          <div className="flex items-center gap-2">
            <Lock size={13} style={{ color: ACCENT }} />
            <p className="text-[11px]" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
              Vendas online pausadas
            </p>
          </div>
          <button type="button" onClick={retomar} disabled={pausando}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg"
            style={{ background: `${ACCENT}20`, color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
            {pausando ? <Loader2 size={11} className="animate-spin" /> : <Unlock size={11} />}
            Retomar
          </button>
        </div>
      )}

      <div className="max-w-2xl mx-auto w-full px-5 py-6 flex flex-col gap-6">

        {/* Totais gerais */}
        <div className="rounded-2xl p-4 flex flex-col gap-3"
             style={{ background: '#0d0d0d', border: `1px solid ${ACCENT}25` }}>
          <div className="flex items-center justify-between">
            <p className="text-[#555] text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Total geral — todos os caixas
            </p>
            <TrendingUp size={14} style={{ color: ACCENT }} />
          </div>
          <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-outfit)', color: ACCENT }}>
            R$ {totalGeral.toFixed(2).replace('.', ',')}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Dinheiro', value: totalDinheiro, Icon: Banknote },
              { label: 'PIX',      value: totalPix,      Icon: Smartphone },
              { label: 'Cartão',   value: totalCartao,   Icon: CreditCard },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="rounded-xl px-3 py-2.5" style={{ background: '#111' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={11} className="text-[#555]" />
                  <p className="text-[#555] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
                </div>
                <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  R$ {value.toFixed(2).replace('.', ',')}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Caixas abertos */}
        {abertos.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[#555] text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  {abertos.length} caixa{abertos.length > 1 ? 's' : ''} aberto{abertos.length > 1 ? 's' : ''}
                </span>
              </p>
              <button type="button" onClick={() => { setFase('configurando'); setConfigs([{ nome: 'Caixa ' + String.fromCharCode(65 + caixas.length), fundo_inicial: 0, ingressos_alocados: 0 }]) }}
                className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-xl"
                style={{ background: '#111', border: `1px solid ${ACCENT}30`, color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                <Plus size={11} /> Novo caixa
              </button>
            </div>
            {abertos.map(c => (
              <CaixaCard key={c.id} caixa={c} eventoId={eventoId} />
            ))}
          </div>
        )}

        {/* Caixas fechados */}
        {fechados.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[#333] text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {fechados.length} caixa{fechados.length > 1 ? 's' : ''} fechado{fechados.length > 1 ? 's' : ''}
            </p>
            {fechados.map(c => (
              <CaixaCard key={c.id} caixa={c} eventoId={eventoId} fechado />
            ))}
          </div>
        )}

        {/* Botão abrir novo caixa */}
        {abertos.length === 0 && (
          <button type="button" onClick={pausarVendas} disabled={pausando}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold text-[#070707] disabled:opacity-50 hover:brightness-110 active:scale-[0.98] transition-all"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
            {pausando ? <><Loader2 size={18} className="animate-spin" /> Pausando...</> : <><Plus size={18} /> Abrir novos caixas</>}
          </button>
        )}

      </div>
    </div>
  )
}

function CaixaCard({ caixa, eventoId, fechado = false }: { caixa: CaixaAberto; eventoId: string; fechado?: boolean }) {
  return (
    <Link href={`/bilheteria/${eventoId}/caixa/${caixa.id}`}
      className="rounded-2xl p-4 flex flex-col gap-3 transition-all hover:border-[#2a2a2a]"
      style={{ background: fechado ? '#0a0a0a' : '#0d0d0d', border: `1px solid ${fechado ? '#141414' : '#1a1a1a'}` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full" style={{ background: fechado ? '#333' : '#4ade80' }} />
          <span className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)', opacity: fechado ? 0.5 : 1 }}>
            {caixa.nome}
          </span>
          {caixa.operadorName && (
            <span className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              • {caixa.operadorName}
            </span>
          )}
        </div>
        <ChevronRight size={14} className="text-[#333]" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Vendidos" value={String(caixa.vendidos)} muted={fechado} />
        <Stat label="Saldo físico" value={String(caixa.saldoIngressos)} muted={fechado} alert={!fechado && caixa.saldoIngressos <= 5} />
        <Stat label="Total vendas" value={`R$ ${caixa.totalVendas.toFixed(2).replace('.', ',')}`} muted={fechado} accent={!fechado} />
      </div>
    </Link>
  )
}

function Stat({ label, value, muted, accent, alert }: { label: string; value: string; muted?: boolean; accent?: boolean; alert?: boolean }) {
  return (
    <div className="rounded-xl px-2.5 py-2" style={{ background: '#111' }}>
      <p className="text-[#444] text-[10px] uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
      <p className="text-sm font-semibold" style={{
        fontFamily: 'var(--font-dm-sans)',
        color: alert ? '#f87171' : accent ? ACCENT : muted ? '#333' : '#ddd',
      }}>{value}</p>
    </div>
  )
}

function Header({ eventoTitle, eventoId, onRefresh }: { eventoTitle: string; eventoId: string; onRefresh?: () => void }) {
  return (
    <div className="px-6 py-5 border-b border-[#111] flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
           style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30` }}>
        <Users size={16} style={{ color: ACCENT }} />
      </div>
      <div className="flex-1">
        <h1 className="text-white text-base font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Caixas
        </h1>
        <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{eventoTitle}</p>
      </div>
      <div className="flex items-center gap-2">
        {onRefresh && (
          <button type="button" onClick={onRefresh}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#555] hover:text-white transition-colors"
            style={{ background: '#0d0d0d', border: '1px solid #1e1e1e' }}>
            <RefreshCw size={13} />
          </button>
        )}
        <Link href={`/dashboard/${eventoId}`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs hover:text-white transition-colors"
          style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', color: '#555', fontFamily: 'var(--font-dm-sans)' }}>
          <ArrowLeft size={13} /> Voltar
        </Link>
      </div>
    </div>
  )
}

function _ArrowRightLeftPlaceholder() { return <ArrowRightLeft size={0} /> }
