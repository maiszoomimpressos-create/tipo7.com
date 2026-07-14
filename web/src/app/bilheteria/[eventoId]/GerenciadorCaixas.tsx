'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus, Trash2, ArrowLeft, Loader2, AlertTriangle, CheckCircle2,
  ShoppingBag, Lock, Unlock, Users, TrendingUp,
  Banknote, Smartphone, CreditCard, RefreshCw, ChevronRight,
  Calculator, Pencil,
} from 'lucide-react'
import { CalculadoraDinheiro } from './CalculadoraDinheiro'

const ACCENT = '#E8B84B'

interface CaixaConfig {
  nome:               string
  fundo_inicial:      number
  ingressos_alocados: number
  tipoOperador:       'nenhum' | 'cadastrado' | 'sem_cadastro'
  operadorId:         string | null
  operadorNome:       string | null
  nomeOperadorLivre:  string
}

interface MembroEquipe {
  userId:   string
  nome:     string | null
  cargo:    string | null
  email:    string | null
  userCode: string | null
}

interface CaixaAberto {
  id:                 string
  nome:               string
  status:             'aberto' | 'fechado'
  operadorId:         string | null
  operadorName:       string | null
  operadorEmail:      string | null
  operadorCode:       string | null
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
    { nome: 'Caixa A', fundo_inicial: 0, ingressos_alocados: 0, tipoOperador: 'nenhum', operadorId: null, operadorNome: null, nomeOperadorLivre: '' },
  ])
  const [equipe, setEquipe]             = useState<MembroEquipe[]>([])
  const [salvando, setSalvando]         = useState(false)
  const [err, setErr]                   = useState<string | null>(null)
  const [pausando, setPausando]         = useState(false)
  const [calcAberto, setCalcAberto]     = useState<{ idx: number; label: string } | null>(null)

  useEffect(() => {
    fetch(`/api/eventos/${eventoId}/equipe`)
      .then(r => r.ok ? r.json() : { staff: [] })
      .then(d => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const membros: MembroEquipe[] = (d.staff ?? [])
          .filter((s: any) => {
            if (s.status !== 'active') return false
            const pos  = Array.isArray(s.event_positions) ? s.event_positions[0] : s.event_positions
            const perms: { permission: string }[] = pos?.event_position_permissions ?? []
            return perms.some(p => p.permission === 'vender_ingresso')
          })
          .map((s: any) => ({
            userId:   s.user_id,
            nome:     (Array.isArray(s.profiles) ? s.profiles[0] : s.profiles)?.full_name ?? s.email ?? null,
            cargo:    (Array.isArray(s.event_positions) ? s.event_positions[0] : s.event_positions)?.name ?? null,
            email:    s.email ?? null,
            userCode: s.userCode ?? null,
          }))
        setEquipe(membros)
      })
      .catch(() => {})
  }, [eventoId])

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

  function nomeCaixaUnico(existentes: string[]) {
    const set = new Set(existentes)
    for (let i = 0; i < 26; i++) {
      const candidato = `Caixa ${String.fromCharCode(65 + i)}`
      if (!set.has(candidato)) return candidato
    }
    return `Caixa ${existentes.length + 1}`
  }

  function addCaixa() {
    const existentes = [...caixas.map(c => c.nome), ...configs.map(c => c.nome)]
    setConfigs(c => [...c, {
      nome: nomeCaixaUnico(existentes), fundo_inicial: 0, ingressos_alocados: 0,
      tipoOperador: 'nenhum', operadorId: null, operadorNome: null, nomeOperadorLivre: '',
    }])
  }

  function iniciarNovoCaixa() {
    const nome = nomeCaixaUnico(caixas.map(c => c.nome))
    setFase('configurando')
    setConfigs([{ nome, fundo_inicial: 0, ingressos_alocados: 0, tipoOperador: 'nenhum', operadorId: null, operadorNome: null, nomeOperadorLivre: '' }])
  }

  function removeCaixa(i: number) {
    setConfigs(c => c.filter((_, idx) => idx !== i))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function updateConfig(i: number, field: string, value: any) {
    setConfigs(c => c.map((cfg, idx) => idx === i ? { ...cfg, [field]: value } : cfg))
  }

  async function confirmarAbertura() {
    for (const c of configs) {
      if (!c.nome.trim()) { setErr('Preencha o nome de todos os caixas.'); return }
      if (c.ingressos_alocados < 0) { setErr('Quantidade de ingressos não pode ser negativa.'); return }
      if (c.tipoOperador === 'cadastrado' && !c.operadorId) {
        setErr(`Caixa "${c.nome}": selecione o operador.`); return
      }
    }
    // Nomes únicos no lote
    const nomesLote = configs.map(c => c.nome.trim())
    if (new Set(nomesLote).size !== nomesLote.length) {
      setErr('Cada caixa deve ter um nome único.'); return
    }
    // Conflito com caixas já abertos
    const nomesAbertos = new Set(caixas.filter(c => c.status === 'aberto').map(c => c.nome))
    for (const nome of nomesLote) {
      if (nomesAbertos.has(nome)) {
        setErr(`Já existe um caixa aberto chamado "${nome}". Escolha um nome diferente.`); return
      }
    }
    // Operadores únicos no lote
    const opsLote = configs.filter(c => c.operadorId).map(c => c.operadorId!)
    if (new Set(opsLote).size !== opsLote.length) {
      setErr('Um operador não pode operar dois caixas ao mesmo tempo.'); return
    }
    // Conflito de operador com caixas já abertos
    const opsAbertos = new Map(caixas.filter(c => c.status === 'aberto' && c.operadorId).map(c => [c.operadorId!, c.nome]))
    for (const opId of opsLote) {
      if (opsAbertos.has(opId)) {
        setErr(`Este operador já está no caixa "${opsAbertos.get(opId)}".`); return
      }
    }
    setSalvando(true); setErr(null)
    const caixasPayload = configs.map(c => ({
      nome:               c.nome,
      fundo_inicial:      c.fundo_inicial,
      ingressos_alocados: c.ingressos_alocados,
      ...(c.tipoOperador === 'cadastrado' && c.operadorId ? { operadorId: c.operadorId } : {}),
      ...(c.tipoOperador === 'sem_cadastro' && c.nomeOperadorLivre.trim()
        ? { nomeOperador: c.nomeOperadorLivre.trim() }
        : {}),
    }))
    const res = await fetch('/api/caixas/abrir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId, caixas: caixasPayload, transferencia_requer_senha: requerSenha }),
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
      <>
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
                <div className="flex items-center justify-between gap-2 group">
                  <input
                    value={cfg.nome}
                    onChange={e => updateConfig(i, 'nome', e.target.value)}
                    placeholder="Nome do caixa"
                    className="flex-1 bg-transparent text-white text-sm font-semibold outline-none placeholder:text-[#333]"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                  <Pencil size={11} className="text-[#2a2a2a] group-hover:text-[#444] transition-colors shrink-0" />
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
                           style={{ fontFamily: 'var(--font-dm-sans)' }}>Troco inicial</label>
                    <button type="button"
                      onClick={() => setCalcAberto({ idx: i, label: cfg.nome })}
                      className="w-full flex items-center justify-between bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm transition-colors hover:border-[#E8B84B]/40"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      <span style={{ color: cfg.fundo_inicial > 0 ? '#fff' : '#444' }}>
                        {cfg.fundo_inicial > 0
                          ? `R$ ${cfg.fundo_inicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : 'R$ 0,00'}
                      </span>
                      <Calculator size={13} style={{ color: ACCENT }} />
                    </button>
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

                {/* Seção operador */}
                <div className="border-t border-[#1a1a1a] pt-3">
                  <label className="text-[#555] text-[10px] uppercase tracking-wider block mb-2"
                         style={{ fontFamily: 'var(--font-dm-sans)' }}>Operador</label>

                  {/* Toggle tipo */}
                  <div className="flex gap-1.5 mb-3">
                    {(['nenhum', 'cadastrado', 'sem_cadastro'] as const).map(tipo => (
                      <button key={tipo} type="button"
                        onClick={() => updateConfig(i, 'tipoOperador', tipo)}
                        className="flex-1 py-1.5 rounded-xl text-[11px] font-medium transition-colors"
                        style={{
                          background: cfg.tipoOperador === tipo ? `${ACCENT}20` : '#111',
                          border:     `1px solid ${cfg.tipoOperador === tipo ? ACCENT + '50' : '#1e1e1e'}`,
                          color:      cfg.tipoOperador === tipo ? ACCENT : '#555',
                          fontFamily: 'var(--font-dm-sans)',
                        }}>
                        {tipo === 'nenhum' ? 'Nenhum' : tipo === 'cadastrado' ? 'Com cadastro' : 'Sem cadastro'}
                      </button>
                    ))}
                  </div>

                  {cfg.tipoOperador === 'cadastrado' && (
                    equipe.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {equipe.map(m => {
                          const selecionado = cfg.operadorId === m.userId
                          return (
                            <button key={m.userId} type="button"
                              onClick={() => {
                                updateConfig(i, 'operadorId',   selecionado ? null : m.userId)
                                updateConfig(i, 'operadorNome', selecionado ? null : m.nome)
                              }}
                              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors"
                              style={{
                                background: selecionado ? `${ACCENT}15` : '#111',
                                border:     `1px solid ${selecionado ? ACCENT + '40' : '#1e1e1e'}`,
                              }}>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: selecionado ? ACCENT : '#ddd', fontFamily: 'var(--font-dm-sans)' }}>
                                  {m.nome ?? '—'}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-2 mt-0.5">
                                  {m.email && (
                                    <p className="text-[11px] truncate" style={{ color: selecionado ? ACCENT + '99' : '#444', fontFamily: 'var(--font-dm-sans)' }}>
                                      {m.email}
                                    </p>
                                  )}
                                  {m.userCode && (
                                    <p className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
                                       style={{ background: selecionado ? `${ACCENT}18` : '#1a1a1a', color: selecionado ? ACCENT + 'cc' : '#555' }}>
                                      {m.userCode}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {selecionado && (
                                <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                                     style={{ background: ACCENT }}>
                                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                    <path d="M1.5 4L3.5 6L6.5 2" stroke="#070707" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        Nenhum membro com função de bilheteiro encontrado. Adicione membros com permissão de vender ingressos em Gestão da Equipe.
                      </p>
                    )
                  )}

                  {cfg.tipoOperador === 'sem_cadastro' && (
                    <input
                      value={cfg.nomeOperadorLivre}
                      onChange={e => updateConfig(i, 'nomeOperadorLivre', e.target.value)}
                      placeholder="Nome do operador"
                      className="w-full bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#333]"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    />
                  )}
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

      {calcAberto !== null && (
        <CalculadoraDinheiro
          label={`Troco inicial — ${calcAberto.label}`}
          valor={configs[calcAberto.idx]?.fundo_inicial ?? 0}
          onChange={v => updateConfig(calcAberto.idx, 'fundo_inicial', v)}
          onClose={() => setCalcAberto(null)}
        />
      )}
      </>
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
              <button type="button" onClick={iniciarNovoCaixa}
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
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: fechado ? '#333' : '#4ade80' }} />
            <span className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)', opacity: fechado ? 0.5 : 1 }}>
              {caixa.nome}
            </span>
          </div>
          {caixa.operadorName && (
            <div className="ml-[18px] flex flex-col gap-0.5">
              <span className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {caixa.operadorName}
              </span>
              {caixa.operadorEmail && (
                <span className="text-[#444] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {caixa.operadorEmail}
                </span>
              )}
              {caixa.operadorCode && (
                <span className="inline-block text-[10px] font-mono w-fit px-1.5 py-0.5 rounded"
                      style={{ background: '#161616', color: '#444' }}>
                  {caixa.operadorCode}
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronRight size={14} className="text-[#333] shrink-0 mt-0.5" />
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

