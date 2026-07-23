'use client'

import { useState, useEffect } from 'react'
import {
  Users, UserPlus, Trash2, Loader2, Check, AlertTriangle,
  Shield, Link2, Plus, ChevronDown, ChevronUp, Pencil, X,
} from 'lucide-react'

const ACCENT = '#E8B84B'

const PERMISSOES = [
  { value: 'validar_ingresso',        label: 'Validar ingresso',     desc: 'Escanear QR na entrada'         },
  { value: 'vender_ingresso',         label: 'Bilheteria',           desc: 'Vender ingressos presencial'    },
  { value: 'ver_lista_convidados',    label: 'Ver lista',            desc: 'Lista de compradores'           },
  { value: 'ver_relatorios',          label: 'Ver relatórios',       desc: 'Vendas e presença'              },
  { value: 'gerenciar_checkin',       label: 'Gerenciar check-in',   desc: 'Controlar entrada/saída'        },
  { value: 'gerenciar_estacionamento', label: 'Estacionamento',      desc: 'Registrar entrada/saída de veículos' },
]

type Funcao = {
  id: string
  name: string
  event_position_permissions: { permission: string }[]
}

type Template = {
  id: string
  name: string
  staff_function_template_permissions: { permission: string }[]
}

type Membro = {
  id: string
  status: string
  email:    string | null
  userCode: string | null
  profiles: { id: string; full_name: string | null; user_code?: string | null } | null
  event_positions: { id: string; name: string; event_position_permissions: { permission: string }[] } | null
}

interface Props {
  eventoId: string
}

// ── Seletor de permissões reutilizável ────────────────────────────────────────

function SeletorPermissoes({
  selecionadas,
  onChange,
}: {
  selecionadas: string[]
  onChange: (p: string[]) => void
}) {
  function toggle(value: string) {
    onChange(
      selecionadas.includes(value)
        ? selecionadas.filter(p => p !== value)
        : [...selecionadas, value]
    )
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {PERMISSOES.map(p => (
        <button
          key={p.value}
          type="button"
          onClick={() => toggle(p.value)}
          className="flex items-start gap-2 p-2.5 rounded-xl text-left transition-colors"
          style={{
            background: selecionadas.includes(p.value) ? `${ACCENT}15` : '#111',
            border: `1px solid ${selecionadas.includes(p.value) ? ACCENT + '40' : '#1e1e1e'}`,
          }}
        >
          <div
            className="w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5"
            style={{
              background: selecionadas.includes(p.value) ? ACCENT : '#1a1a1a',
              border: `1px solid ${selecionadas.includes(p.value) ? ACCENT : '#333'}`,
            }}
          >
            {selecionadas.includes(p.value) && <Check size={10} className="text-[#070707]" />}
          </div>
          <div>
            <p className="text-white text-[11px] font-medium leading-tight" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {p.label}
            </p>
            <p className="text-[#444] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {p.desc}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}

// ── Painel principal ──────────────────────────────────────────────────────────

export function PainelEquipe({ eventoId }: Props) {
  const [membros,     setMembros]     = useState<Membro[]>([])
  const [funcoes,     setFuncoes]     = useState<Funcao[]>([])
  const [templates,   setTemplates]   = useState<Template[]>([])
  const [loadingMem,  setLoadingMem]  = useState(true)
  const [loadingFun,  setLoadingFun]  = useState(true)
  const [removendo,      setRemovendo]      = useState<string | null>(null)
  const [editandoMembro, setEditandoMembro] = useState<string | null>(null)
  const [funcaoEditando, setFuncaoEditando] = useState('')
  const [salvandoMembro, setSalvandoMembro] = useState(false)
  const [linkCopiado,    setLinkCopiado]    = useState(false)

  // seção funções
  const [funcoesAberta,   setFuncoesAberta]   = useState(false)
  const [criandoFuncao,   setCriandoFuncao]   = useState(false)
  const [nomeFuncao,      setNomeFuncao]      = useState('')
  const [permsFuncao,     setPermsFuncao]     = useState<string[]>([])
  const [salvandoFuncao,  setSalvandoFuncao]  = useState(false)
  const [errFuncao,       setErrFuncao]       = useState<string | null>(null)
  const [editandoFuncao,  setEditandoFuncao]  = useState<Funcao | null>(null)
  const [removendoFuncao, setRemovendoFuncao] = useState<string | null>(null)

  // seção convite
  const [adicionando,    setAdicionando]    = useState(false)
  const [emailOuCodigo,  setEmailOuCodigo]  = useState('')
  const [funcaoSel,      setFuncaoSel]      = useState('')
  const [salvando,       setSalvando]       = useState(false)
  const [errConvite,     setErrConvite]     = useState<string | null>(null)
  const [sucesso,        setSucesso]        = useState(false)

  async function carregarMembros() {
    setLoadingMem(true)
    try {
      const res  = await fetch(`/api/eventos/${eventoId}/equipe`)
      const data = await res.json()
      setMembros(data.staff ?? [])
    } finally { setLoadingMem(false) }
  }

  async function carregarFuncoes() {
    setLoadingFun(true)
    try {
      const [resFuncoes, resTemplates] = await Promise.all([
        fetch(`/api/eventos/${eventoId}/funcoes`),
        fetch('/api/staff-function-templates'),
      ])
      const [dFuncoes, dTemplates] = await Promise.all([resFuncoes.json(), resTemplates.json()])
      setFuncoes(dFuncoes.funcoes ?? [])
      setTemplates(dTemplates.templates ?? [])
    } finally { setLoadingFun(false) }
  }

  useEffect(() => { carregarMembros(); carregarFuncoes() }, [eventoId])

  // ── Funções ──

  async function salvarFuncao() {
    if (!nomeFuncao.trim()) { setErrFuncao('Nome é obrigatório'); return }
    setSalvandoFuncao(true); setErrFuncao(null)
    try {
      if (editandoFuncao) {
        await fetch(`/api/eventos/${eventoId}/funcoes/${editandoFuncao.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: nomeFuncao, permissoes: permsFuncao }),
        })
      } else {
        await fetch(`/api/eventos/${eventoId}/funcoes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: nomeFuncao, permissoes: permsFuncao }),
        })
      }
      setNomeFuncao(''); setPermsFuncao([]); setCriandoFuncao(false); setEditandoFuncao(null)
      await carregarFuncoes()
    } catch { setErrFuncao('Erro ao salvar função') }
    finally { setSalvandoFuncao(false) }
  }

  async function removerFuncao(funcaoId: string) {
    setRemovendoFuncao(funcaoId)
    try {
      const res  = await fetch(`/api/eventos/${eventoId}/funcoes/${funcaoId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }
      await carregarFuncoes()
    } finally { setRemovendoFuncao(null) }
  }

  async function importarTemplate(t: Template) {
    try {
      await fetch(`/api/eventos/${eventoId}/funcoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: t.name,
          permissoes: t.staff_function_template_permissions.map(p => p.permission),
        }),
      })
      await carregarFuncoes()
    } catch { /* silencioso */ }
  }

  function iniciarEdicao(f: Funcao) {
    setEditandoFuncao(f)
    setNomeFuncao(f.name)
    setPermsFuncao(f.event_position_permissions.map(p => p.permission))
    setCriandoFuncao(true)
    setFuncoesAberta(true)
  }

  // ── Convite ──

  async function handleAdicionar() {
    if (!emailOuCodigo.trim() || !funcaoSel) {
      setErrConvite('Email/código e função são obrigatórios')
      return
    }
    setSalvando(true); setErrConvite(null); setSucesso(false)
    try {
      const res  = await fetch(`/api/eventos/${eventoId}/equipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOuCodigo: emailOuCodigo.trim(), funcaoId: funcaoSel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao adicionar')
      setSucesso(true); setEmailOuCodigo(''); setFuncaoSel(''); setAdicionando(false)
      await carregarMembros()
    } catch (e: unknown) {
      setErrConvite(e instanceof Error ? e.message : 'Erro ao adicionar')
    } finally { setSalvando(false) }
  }

  async function handleRemover(staffId: string) {
    setRemovendo(staffId)
    try {
      await fetch(`/api/eventos/${eventoId}/equipe?staffId=${staffId}`, { method: 'DELETE' })
      setMembros(prev => prev.filter(m => m.id !== staffId))
    } finally { setRemovendo(null) }
  }

  function abrirEdicaoMembro(m: Membro) {
    setEditandoMembro(m.id)
    setFuncaoEditando(m.event_positions?.id ?? '')
  }

  async function salvarEdicaoMembro() {
    if (!editandoMembro || !funcaoEditando) return
    setSalvandoMembro(true)
    try {
      const res = await fetch(`/api/eventos/${eventoId}/equipe`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ staffId: editandoMembro, funcaoId: funcaoEditando }),
      })
      if (!res.ok) return
      setMembros(prev => prev.map(m => {
        if (m.id !== editandoMembro) return m
        const novaFuncao = funcoes.find(f => f.id === funcaoEditando)
        return { ...m, event_positions: novaFuncao ? { id: novaFuncao.id, name: novaFuncao.name, event_position_permissions: novaFuncao.event_position_permissions } : m.event_positions }
      }))
      setEditandoMembro(null)
    } finally { setSalvandoMembro(false) }
  }

  const permLabel: Record<string, string> = {
    validar_ingresso:        'Validar',
    vender_ingresso:         'Bilheteria',
    ver_lista_convidados:    'Ver lista',
    ver_relatorios:          'Relatórios',
    gerenciar_checkin:       'Check-in',
    gerenciar_estacionamento: 'Estacionamento',
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Cabeçalho ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={14} style={{ color: ACCENT }} />
          <span className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-outfit)' }}>
            Equipe do evento
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/bilheteria/${eventoId}`)
              setLinkCopiado(true)
              setTimeout(() => setLinkCopiado(false), 2000)
            }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{
              background: linkCopiado ? '#4ade8015' : '#111',
              border: `1px solid ${linkCopiado ? '#4ade8040' : '#222'}`,
              color: linkCopiado ? '#4ade80' : '#666',
            }}
            title="Copiar link da bilheteria"
          >
            {linkCopiado ? <Check size={12} /> : <Link2 size={12} />}
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/scanner/${eventoId}`)}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ background: '#111', border: '1px solid #222', color: '#666' }}
            title="Copiar link do scanner"
          >
            <Link2 size={12} />
          </button>
          {!adicionando && (
            <button
              type="button"
              onClick={() => { setAdicionando(true); setErrConvite(null); setSucesso(false) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#070707] hover:brightness-110"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
            >
              <UserPlus size={12} />
              Adicionar
            </button>
          )}
        </div>
      </div>

      {/* ── Seção: Funções do evento ── */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
        <button
          type="button"
          onClick={() => setFuncoesAberta(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/2"
          style={{ background: '#0d0d0d' }}
        >
          <div className="flex items-center gap-2">
            <Shield size={12} style={{ color: ACCENT }} />
            <span className="text-white text-xs font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Funções do evento
            </span>
            {funcoes.length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                style={{ background: `${ACCENT}15`, color: ACCENT }}
              >
                {funcoes.length}
              </span>
            )}
          </div>
          {funcoesAberta ? <ChevronUp size={13} className="text-[#444]" /> : <ChevronDown size={13} className="text-[#444]" />}
        </button>

        {funcoesAberta && (
          <div className="px-4 pb-4 pt-2 flex flex-col gap-3" style={{ background: '#0d0d0d', borderTop: '1px solid #1a1a1a' }}>

            {/* Lista de funções */}
            {loadingFun ? (
              <div className="flex justify-center py-4">
                <Loader2 size={16} className="text-[#333] animate-spin" />
              </div>
            ) : funcoes.length === 0 && !criandoFuncao ? (
              <p className="text-[#444] text-xs text-center py-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Nenhuma função criada. Crie uma para poder convidar membros.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {funcoes.map(f => (
                  <div
                    key={f.id}
                    className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-xl"
                    style={{ background: '#111', border: '1px solid #1e1e1e' }}
                  >
                    <div className="min-w-0">
                      <p className="text-white text-xs font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {f.name}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {f.event_position_permissions.length === 0 ? (
                          <span className="text-[#333] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                            Sem permissões
                          </span>
                        ) : f.event_position_permissions.map(p => (
                          <span
                            key={p.permission}
                            className="px-1.5 py-0.5 rounded text-[9px]"
                            style={{ background: `${ACCENT}10`, color: '#888', fontFamily: 'var(--font-dm-sans)' }}
                          >
                            {permLabel[p.permission] ?? p.permission}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => iniciarEdicao(f)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#1a1a1a] transition-colors"
                      >
                        <Pencil size={11} className="text-[#444] hover:text-white" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removerFuncao(f.id)}
                        disabled={removendoFuncao === f.id}
                        className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#1a1a1a] transition-colors disabled:opacity-40"
                      >
                        {removendoFuncao === f.id
                          ? <Loader2 size={11} className="text-[#444] animate-spin" />
                          : <Trash2 size={11} className="text-[#444] hover:text-red-400" />
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Templates disponíveis — funções do sistema não ainda adicionadas */}
            {(() => {
              const funcaoIds = new Set(funcoes.map(f => f.name.toLowerCase()))
              const disponiveis = templates.filter(t => !funcaoIds.has(t.name.toLowerCase()))
              if (disponiveis.length === 0) return null
              return (
                <div>
                  <p className="text-[#333] text-[10px] uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Adicionar do sistema
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {disponiveis.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => importarTemplate(t)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors hover:border-[#E8B84B]/30 hover:text-white"
                        style={{ background: '#111', border: '1px solid #1e1e1e', color: '#555', fontFamily: 'var(--font-dm-sans)' }}
                        title={t.staff_function_template_permissions.map(p => permLabel[p.permission] ?? p.permission).join(', ')}
                      >
                        <Plus size={10} />
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Formulário de nova/editar função */}
            {criandoFuncao ? (
              <div className="rounded-xl p-3 flex flex-col gap-3" style={{ background: '#111', border: `1px solid ${ACCENT}25` }}>
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                  {editandoFuncao ? 'Editar função' : 'Nova função'}
                </p>
                <input
                  type="text"
                  value={nomeFuncao}
                  onChange={e => setNomeFuncao(e.target.value)}
                  placeholder="Nome da função (ex: Segurança, Coordenador)"
                  className="w-full bg-[#0d0d0d] border border-[#222] rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
                <SeletorPermissoes selecionadas={permsFuncao} onChange={setPermsFuncao} />
                {errFuncao && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertTriangle size={11} /> {errFuncao}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setCriandoFuncao(false); setEditandoFuncao(null); setNomeFuncao(''); setPermsFuncao([]) }}
                    className="flex-1 py-2 rounded-xl text-xs text-[#444] border border-[#1e1e1e] hover:text-white transition-colors"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={salvarFuncao}
                    disabled={salvandoFuncao}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold text-[#070707] disabled:opacity-60"
                    style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {salvandoFuncao ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    {editandoFuncao ? 'Salvar' : 'Criar'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setCriandoFuncao(true); setEditandoFuncao(null); setNomeFuncao(''); setPermsFuncao([]) }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs transition-colors hover:border-[#333] hover:text-white"
                style={{ border: '1px dashed #222', color: '#444', fontFamily: 'var(--font-dm-sans)' }}
              >
                <Plus size={12} />
                Nova função
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Formulário de novo membro ── */}
      {adicionando && (
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ border: `1px solid ${ACCENT}30`, background: '#0d0d0d' }}>
          <div className="flex items-center justify-between">
            <p className="text-[#E8B84B] text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Novo membro
            </p>
            <button type="button" onClick={() => setAdicionando(false)}>
              <X size={13} className="text-[#444] hover:text-white" />
            </button>
          </div>

          <input
            type="text"
            value={emailOuCodigo}
            onChange={e => setEmailOuCodigo(e.target.value)}
            placeholder="Email ou código T7-USR do usuário"
            className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          />

          {/* Seleção de função */}
          {funcoes.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
              <AlertTriangle size={12} style={{ color: ACCENT }} />
              <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Crie uma função antes de convidar membros.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="text-[#555] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Função
              </p>
              <div className="flex flex-col gap-1.5">
                {funcoes.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFuncaoSel(f.id)}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors"
                    style={{
                      background: funcaoSel === f.id ? `${ACCENT}12` : '#111',
                      border: `1px solid ${funcaoSel === f.id ? ACCENT + '40' : '#1e1e1e'}`,
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: funcaoSel === f.id ? ACCENT : 'transparent',
                        borderColor: funcaoSel === f.id ? ACCENT : '#333',
                      }}
                    >
                      {funcaoSel === f.id && <div className="w-1.5 h-1.5 rounded-full bg-[#070707]" />}
                    </div>
                    <div>
                      <p className="text-white text-xs font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {f.name}
                      </p>
                      <p className="text-[#444] text-[10px] mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {f.event_position_permissions.length === 0
                          ? 'Sem permissões'
                          : f.event_position_permissions.map(p => permLabel[p.permission] ?? p.permission).join(', ')
                        }
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {errConvite && (
            <div className="flex items-center gap-2 text-red-400 text-xs py-2 px-3 rounded-lg bg-red-400/5">
              <AlertTriangle size={12} className="shrink-0" />
              {errConvite}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setAdicionando(false); setErrConvite(null) }}
              className="flex-1 py-2.5 rounded-xl text-xs text-[#444] border border-[#1e1e1e] hover:text-white hover:border-[#333] transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdicionar}
              disabled={salvando || funcoes.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-[#070707] disabled:opacity-60"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
            >
              {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {salvando ? 'Enviando...' : 'Enviar convite'}
            </button>
          </div>
        </div>
      )}

      {/* Feedback de sucesso */}
      {sucesso && (
        <div className="flex items-center gap-2 text-green-400 text-xs py-2 px-3 rounded-lg bg-green-400/5">
          <Check size={12} />
          Convite enviado! O membro verá em "Trabalhos".
        </div>
      )}

      {/* ── Lista de membros ── */}
      {loadingMem ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="text-[#333] animate-spin" />
        </div>
      ) : membros.length === 0 ? (
        <div className="text-center py-8 rounded-2xl" style={{ border: '1px solid #1a1a1a', background: '#0d0d0d' }}>
          <Shield size={24} className="text-[#222] mx-auto mb-2" />
          <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Nenhum membro na equipe ainda.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {membros.map(m => {
            const profile  = m.profiles
            const position = m.event_positions as { id: string; name: string; event_position_permissions: { permission: string }[] } | null
            const editando = editandoMembro === m.id
            return (
              <div
                key={m.id}
                className="rounded-xl overflow-hidden"
                style={{ background: '#0d0d0d', border: `1px solid ${editando ? ACCENT + '30' : '#1a1a1a'}` }}
              >
                {/* Linha principal */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {profile?.full_name ?? 'Usuário'}
                    </p>
                    {m.email && (
                      <p className="text-[#555] text-xs mt-0.5 truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {m.email}
                      </p>
                    )}
                    <div className="flex items-center flex-wrap gap-1.5 mt-1">
                      <span className="text-[#444] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {position?.name ?? 'Sem cargo'}
                      </span>
                      {position && (
                        <span className="text-[#333] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          {position.event_position_permissions.length} permiss{position.event_position_permissions.length === 1 ? 'ão' : 'ões'}
                        </span>
                      )}
                      {m.userCode && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold"
                          style={{ background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
                        >
                          {m.userCode}
                        </span>
                      )}
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase"
                        style={{
                          background: m.status === 'active' ? '#4ade8015' : '#E8B84B15',
                          color:      m.status === 'active' ? '#4ade80'   : ACCENT,
                        }}
                      >
                        {m.status === 'active' ? 'Ativo' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => editando ? setEditandoMembro(null) : abrirEdicaoMembro(m)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#1a1a1a] transition-colors"
                    >
                      {editando
                        ? <X size={13} className="text-[#555]" />
                        : <Pencil size={13} className="text-[#444] hover:text-white" />
                      }
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemover(m.id)}
                      disabled={removendo === m.id}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#1a1a1a] transition-colors disabled:opacity-40"
                    >
                      {removendo === m.id
                        ? <Loader2 size={13} className="text-[#444] animate-spin" />
                        : <Trash2  size={13} className="text-[#444] hover:text-red-400" />
                      }
                    </button>
                  </div>
                </div>

                {/* Painel de edição inline */}
                {editando && (
                  <div className="px-4 pb-4 pt-1 flex flex-col gap-3" style={{ borderTop: '1px solid #1a1a1a' }}>
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                      Alterar função
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {funcoes.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFuncaoEditando(f.id)}
                          className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors"
                          style={{
                            background: funcaoEditando === f.id ? `${ACCENT}12` : '#111',
                            border: `1px solid ${funcaoEditando === f.id ? ACCENT + '40' : '#1e1e1e'}`,
                          }}
                        >
                          <div
                            className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5"
                            style={{
                              background:  funcaoEditando === f.id ? ACCENT : 'transparent',
                              borderColor: funcaoEditando === f.id ? ACCENT : '#333',
                            }}
                          >
                            {funcaoEditando === f.id && <div className="w-1.5 h-1.5 rounded-full bg-[#070707]" />}
                          </div>
                          <div>
                            <p className="text-white text-xs font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                              {f.name}
                            </p>
                            <p className="text-[#444] text-[10px] mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                              {f.event_position_permissions.length === 0
                                ? 'Sem permissões'
                                : f.event_position_permissions.map(p => permLabel[p.permission] ?? p.permission).join(', ')
                              }
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditandoMembro(null)}
                        className="flex-1 py-2 rounded-xl text-xs text-[#444] border border-[#1e1e1e] hover:text-white transition-colors"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={salvarEdicaoMembro}
                        disabled={salvandoMembro || !funcaoEditando}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold text-[#070707] disabled:opacity-60"
                        style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
                      >
                        {salvandoMembro ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        Salvar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
