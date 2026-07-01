'use client'

import { useState } from 'react'
import { Plus, Trash2, Loader2, Check, Tag, Users, Globe, AlertTriangle, ShieldAlert, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ACCENT = '#E8B84B'

type RuleType = 'event' | 'promoter_quota' | 'global_quota'

interface Rule {
  id:              string
  name:            string
  type:            RuleType
  discount_pct:    number
  quota_limit:     number | null
  quota_period:    'total' | 'monthly' | null
  bypass_minimum:  boolean
  active:          boolean
  notes:           string | null
  created_at:      string
  event_title?:    string | null
  promoter_name?:  string | null
  quota_used?:     number
}

interface Evento   { id: string; title: string }
interface Promotor { id: string; nome:  string }

interface Props {
  initialRules:  Rule[]
  eventos:       Evento[]
  promotores:    Promotor[]
}

const TYPE_LABEL: Record<RuleType, string> = {
  event:           'Evento específico',
  promoter_quota:  'Quota por promotor',
  global_quota:    'Quota global',
}
const TYPE_ICON: Record<RuleType, typeof Tag> = {
  event:          Tag,
  promoter_quota: Users,
  global_quota:   Globe,
}
const TYPE_COLOR: Record<RuleType, string> = {
  event:          '#a855f7',
  promoter_quota: '#E8B84B',
  global_quota:   '#22c55e',
}

export function RulesClient({ initialRules, eventos, promotores }: Props) {
  const [rules,     setRules]     = useState<Rule[]>(initialRules)
  const [criando,   setCriando]   = useState(false)
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [salvando,  setSalvando]  = useState(false)
  const [err,       setErr]       = useState<string | null>(null)
  const [sucesso,   setSucesso]   = useState(false)

  // Form state
  const [nome,        setNome]        = useState('')
  const [tipo,        setTipo]        = useState<RuleType>('event')
  const [eventoId,    setEventoId]    = useState('')
  const [promotorId,  setPromotorId]  = useState('')
  const [desconto,    setDesconto]    = useState('100')
  const [quotaLimit,  setQuotaLimit]  = useState('100')
  const [quotaPeriod, setQuotaPeriod] = useState<'total' | 'monthly'>('total')
  const [notas,       setNotas]       = useState('')
  const [bypassMin,   setBypassMin]   = useState(false)

  // Modal de senha para bypass do mínimo
  const [modalSenha,  setModalSenha]  = useState(false)
  const [senha,       setSenha]       = useState('')
  const [mostraSenha, setMostraSenha] = useState(false)
  const [errSenha,    setErrSenha]    = useState<string | null>(null)
  const [verificando, setVerificando] = useState(false)

  function resetForm() {
    setNome(''); setTipo('event'); setEventoId(''); setPromotorId('')
    setDesconto('100'); setQuotaLimit('100'); setQuotaPeriod('total'); setNotas('')
    setBypassMin(false); setSenha(''); setErrSenha(null); setErr(null)
  }

  async function verificarSenhaEAtivar() {
    if (!senha.trim()) { setErrSenha('Digite sua senha'); return }
    setVerificando(true); setErrSenha(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) throw new Error('Usuário não encontrado')
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: senha })
      if (error) throw new Error('Senha incorreta')
      setBypassMin(true)
      setModalSenha(false)
      setSenha('')
    } catch (e) {
      setErrSenha(e instanceof Error ? e.message : 'Erro')
    } finally {
      setVerificando(false)
    }
  }

  async function handleCriar() {
    if (!nome.trim()) { setErr('Nome obrigatório'); return }
    if (tipo === 'event' && !eventoId) { setErr('Selecione o evento'); return }
    if (tipo === 'promoter_quota' && !promotorId) { setErr('Selecione o promotor'); return }

    setSalvando(true); setErr(null)
    try {
      const res  = await fetch('/api/admin/fee-rules', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:            nome.trim(),
          type:            tipo,
          event_id:        tipo === 'event'          ? eventoId   : undefined,
          user_id:         tipo === 'promoter_quota' ? promotorId : undefined,
          discount_pct:    parseFloat(desconto) || 100,
          quota_limit:     tipo !== 'event' ? parseInt(quotaLimit) || null : null,
          quota_period:    tipo !== 'event' ? quotaPeriod : null,
          bypass_minimum:  bypassMin,
          notes:           notas.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar regra')

      // Enriquece com nomes locais para exibir imediatamente
      const enriched: Rule = {
        ...data.rule,
        event_title:   tipo === 'event'          ? eventos.find(e => e.id === eventoId)?.title ?? null      : null,
        promoter_name: tipo === 'promoter_quota' ? promotores.find(p => p.id === promotorId)?.nome ?? null : null,
        quota_used: 0,
      }
      setRules(prev => [enriched, ...prev])
      setSucesso(true); setCriando(false); resetForm()
      setTimeout(() => setSucesso(false), 3000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSalvando(false)
    }
  }

  async function handleRemover(id: string) {
    setRemovendo(id)
    try {
      await fetch(`/api/admin/fee-rules?id=${id}`, { method: 'DELETE' })
      setRules(prev => prev.filter(r => r.id !== id))
    } finally {
      setRemovendo(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 mt-8">

      {/* Modal de confirmação de senha */}
      {modalSenha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
               style={{ background: '#0d0d0d', border: '1px solid #ef444430' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/10 border border-red-500/20 shrink-0">
                <ShieldAlert size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Autorização necessária
                </p>
                <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Digite sua senha para zerar todas as taxas, incluindo a operacional.
                </p>
              </div>
            </div>

            <div className="relative">
              <input
                type={mostraSenha ? 'text' : 'password'}
                placeholder="Sua senha"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verificarSenhaEAtivar()}
                autoFocus
                className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-red-400/40 placeholder:text-[#383838] pr-10"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
              <button type="button" onClick={() => setMostraSenha(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors">
                {mostraSenha ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {errSenha && (
              <div className="flex items-center gap-2 text-red-400 text-xs py-2 px-3 rounded-lg bg-red-400/5">
                <AlertTriangle size={12} /> {errSenha}
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => { setModalSenha(false); setSenha(''); setErrSenha(null) }}
                className="flex-1 py-2.5 rounded-xl text-xs text-[#444] border border-[#1e1e1e] hover:text-white transition-colors"
                style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Cancelar
              </button>
              <button type="button" onClick={verificarSenhaEAtivar} disabled={verificando}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-white disabled:opacity-60"
                style={{ background: '#ef4444', fontFamily: 'var(--font-dm-sans)' }}>
                {verificando ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
                {verificando ? 'Verificando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Regras de isenção / desconto
          </p>
          <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Por evento, por promotor ou quota global da plataforma
          </p>
        </div>
        {!criando && (
          <button
            type="button"
            onClick={() => { setCriando(true); setErr(null) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#070707]"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
            <Plus size={13} /> Nova regra
          </button>
        )}
      </div>

      {/* Formulário de criação */}
      {criando && (
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: '#0d0d0d', border: `1px solid ${ACCENT}30` }}>
          <p className="text-[#E8B84B] text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Nova regra
          </p>

          {/* Nome */}
          <input
            type="text"
            placeholder="Nome da regra (ex: Evento beneficente, Testes junho)"
            value={nome}
            onChange={e => setNome(e.target.value)}
            className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          />

          {/* Tipo */}
          <div>
            <p className="text-[#555] text-[10px] uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>Tipo de regra</p>
            <div className="grid grid-cols-3 gap-2">
              {(['event', 'promoter_quota', 'global_quota'] as RuleType[]).map(t => {
                const Icon  = TYPE_ICON[t]
                const color = TYPE_COLOR[t]
                const ativo = tipo === t
                return (
                  <button key={t} type="button" onClick={() => setTipo(t)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-[10px] font-semibold transition-all"
                    style={{
                      background: ativo ? `${color}18` : '#111',
                      border:     `1px solid ${ativo ? color + '50' : '#222'}`,
                      color:      ativo ? color : '#555',
                      fontFamily: 'var(--font-dm-sans)',
                    }}>
                    <Icon size={14} />
                    {TYPE_LABEL[t]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Evento */}
          {tipo === 'event' && (
            <select value={eventoId} onChange={e => setEventoId(e.target.value)}
              className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#E8B84B]/40"
              style={{ color: eventoId ? 'white' : '#383838', fontFamily: 'var(--font-dm-sans)' }}>
              <option value="">Selecione o evento</option>
              {eventos.map(e => <option key={e.id} value={e.id} style={{ color: 'white', background: '#111' }}>{e.title}</option>)}
            </select>
          )}

          {/* Promotor */}
          {tipo === 'promoter_quota' && (
            <select value={promotorId} onChange={e => setPromotorId(e.target.value)}
              className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#E8B84B]/40"
              style={{ color: promotorId ? 'white' : '#383838', fontFamily: 'var(--font-dm-sans)' }}>
              <option value="">Selecione o promotor</option>
              {promotores.map(p => <option key={p.id} value={p.id} style={{ color: 'white', background: '#111' }}>{p.nome}</option>)}
            </select>
          )}

          {/* Quota (para tipos com limite) */}
          {tipo !== 'event' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[#555] text-[10px] uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Limite de ingressos
                </p>
                <input type="number" min="1" value={quotaLimit} onChange={e => setQuotaLimit(e.target.value)}
                  className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40"
                  style={{ fontFamily: 'var(--font-dm-sans)' }} />
              </div>
              <div>
                <p className="text-[#555] text-[10px] uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Período
                </p>
                <div className="flex gap-2">
                  {(['total', 'monthly'] as const).map(p => (
                    <button key={p} type="button" onClick={() => setQuotaPeriod(p)}
                      className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold transition-all"
                      style={{
                        background: quotaPeriod === p ? `${ACCENT}18` : '#111',
                        border:     `1px solid ${quotaPeriod === p ? ACCENT + '50' : '#222'}`,
                        color:      quotaPeriod === p ? ACCENT : '#555',
                        fontFamily: 'var(--font-dm-sans)',
                      }}>
                      {p === 'total' ? 'Total' : 'Mensal'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Desconto */}
          <div>
            <p className="text-[#555] text-[10px] uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Desconto na taxa ({desconto}% → taxa cobrada: {(10 * (1 - parseFloat(desconto || '0') / 100)).toFixed(1)}%)
            </p>
            <div className="flex gap-2">
              {['100', '50', '25'].map(v => (
                <button key={v} type="button" onClick={() => setDesconto(v)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: desconto === v ? `${ACCENT}18` : '#111',
                    border:     `1px solid ${desconto === v ? ACCENT + '50' : '#222'}`,
                    color:      desconto === v ? ACCENT : '#555',
                    fontFamily: 'var(--font-dm-sans)',
                  }}>
                  {v === '100' ? 'Isenção total' : `${v}% off`}
                </button>
              ))}
              <input type="number" min="0" max="100" value={desconto} onChange={e => setDesconto(e.target.value)}
                placeholder="%" className="w-20 bg-[#111] border border-[#222] rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-[#E8B84B]/40 text-center"
                style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
          </div>

          {/* Notas */}
          <input type="text" placeholder="Observação interna (opcional)" value={notas} onChange={e => setNotas(e.target.value)}
            className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
            style={{ fontFamily: 'var(--font-dm-sans)' }} />

          {/* Bypass da taxa mínima — requer senha */}
          <button
            type="button"
            onClick={() => bypassMin ? setBypassMin(false) : setModalSenha(true)}
            className="flex items-center gap-3 w-full p-3 rounded-xl text-left transition-all"
            style={{
              background: bypassMin ? '#ef444415' : '#111',
              border:     `1px solid ${bypassMin ? '#ef444440' : '#222'}`,
            }}>
            <ShieldAlert size={14} style={{ color: bypassMin ? '#ef4444' : '#555' }} className="shrink-0" />
            <div>
              <p className="text-sm font-medium" style={{ color: bypassMin ? '#ef4444' : '#666', fontFamily: 'var(--font-dm-sans)' }}>
                {bypassMin ? 'Isenção total autorizada (inclui taxa mínima)' : 'Zerar 100% — incluindo taxa operacional mínima'}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: bypassMin ? '#ef444480' : '#444', fontFamily: 'var(--font-dm-sans)' }}>
                {bypassMin ? 'Clique para remover autorização' : 'Requer confirmação com senha de administrador'}
              </p>
            </div>
          </button>

          {err && (
            <div className="flex items-center gap-2 text-red-400 text-xs py-2 px-3 rounded-lg bg-red-400/5">
              <AlertTriangle size={12} /> {err}
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => { setCriando(false); resetForm() }}
              className="flex-1 py-2.5 rounded-xl text-xs text-[#444] border border-[#1e1e1e] hover:text-white transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Cancelar
            </button>
            <button type="button" onClick={handleCriar} disabled={salvando}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-[#070707] disabled:opacity-60"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
              {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {salvando ? 'Salvando...' : 'Criar regra'}
            </button>
          </div>
        </div>
      )}

      {sucesso && (
        <div className="flex items-center gap-2 text-green-400 text-xs py-2 px-3 rounded-lg bg-green-400/5">
          <Check size={12} /> Regra criada com sucesso!
        </div>
      )}

      {/* Lista de regras */}
      <div className="flex flex-col gap-2">
        {rules.length === 0 && (
          <div className="py-10 text-center text-[#333] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Nenhuma regra criada ainda.
          </div>
        )}
        {rules.map(rule => {
          const Icon  = TYPE_ICON[rule.type]
          const color = TYPE_COLOR[rule.type]
          const isQuota = rule.type !== 'event'
          const pctEfetiva = 10 * (1 - rule.discount_pct / 100)

          return (
            <div key={rule.id} className="flex items-center justify-between px-5 py-4 rounded-2xl"
                 style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                     style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <div>
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {rule.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color, fontFamily: 'var(--font-dm-sans)' }}>
                      {TYPE_LABEL[rule.type]}
                    </span>
                    {rule.event_title && (
                      <span className="text-[#444] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        · {rule.event_title}
                      </span>
                    )}
                    {rule.promoter_name && (
                      <span className="text-[#444] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        · {rule.promoter_name}
                      </span>
                    )}
                    <span className="text-[#555] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      · taxa {pctEfetiva.toFixed(1)}%
                    </span>
                    {isQuota && rule.quota_limit && (
                      <span className="text-[#555] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        · {rule.quota_used ?? 0}/{rule.quota_limit} ingressos {rule.quota_period === 'monthly' ? '(mês)' : '(total)'}
                      </span>
                    )}
                    {rule.bypass_minimum && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430', fontFamily: 'var(--font-dm-sans)' }}>
                        0% total
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => handleRemover(rule.id)} disabled={removendo === rule.id}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#1a1a1a] transition-colors disabled:opacity-40">
                {removendo === rule.id
                  ? <Loader2 size={14} className="text-[#444] animate-spin" />
                  : <Trash2  size={14} className="text-[#444] hover:text-red-400 transition-colors" />
                }
              </button>
            </div>
          )
        })}
      </div>

      {/* Painel: Eventos com taxa ajustada */}
      {rules.some(r => r.type === 'event') && (
        <div className="mt-4 rounded-2xl overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a' }}>
            <Tag size={13} style={{ color: '#a855f7' }} />
            <p className="text-white text-xs font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Eventos com taxa ajustada
            </p>
            <span className="ml-auto text-[#444] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {rules.filter(r => r.type === 'event').length} evento{rules.filter(r => r.type === 'event').length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ background: '#070707' }}>
            {rules.filter(r => r.type === 'event').map((rule, i, arr) => {
              const pctEfetiva = 10 * (1 - rule.discount_pct / 100)
              return (
                <div key={rule.id}
                     className="flex items-center justify-between px-5 py-3"
                     style={{ borderBottom: i < arr.length - 1 ? '1px solid #111' : 'none' }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-xs font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {rule.event_title ?? rule.name}
                    </p>
                    {rule.notes && (
                      <p className="text-[#444] text-[10px] mt-0.5 truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {rule.notes}
                      </p>
                    )}
                  </div>
                  <div className="ml-3 shrink-0">
                    {rule.bypass_minimum ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430', fontFamily: 'var(--font-dm-sans)' }}>
                        0% total
                      </span>
                    ) : rule.discount_pct === 100 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: '#E8B84B15', color: '#E8B84B', border: '1px solid #E8B84B30', fontFamily: 'var(--font-dm-sans)' }}>
                        Isento
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: '#a855f715', color: '#a855f7', border: '1px solid #a855f730', fontFamily: 'var(--font-dm-sans)' }}>
                        {pctEfetiva.toFixed(1)}% taxa
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
