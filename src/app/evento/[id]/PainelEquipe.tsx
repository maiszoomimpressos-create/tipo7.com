'use client'

import { useState, useEffect } from 'react'
import { Users, UserPlus, Trash2, Loader2, Check, AlertTriangle, Shield, Link2 } from 'lucide-react'

const ACCENT = '#E8B84B'

const PERMISSOES = [
  { value: 'validar_ingresso',     label: 'Validar ingresso',     desc: 'Escanear QR na entrada' },
  { value: 'vender_ingresso',      label: 'Bilheteria',           desc: 'Vender ingressos presencial' },
  { value: 'ver_lista_convidados', label: 'Ver lista',            desc: 'Lista de compradores' },
  { value: 'ver_relatorios',       label: 'Ver relatórios',       desc: 'Vendas e presença' },
  { value: 'gerenciar_checkin',    label: 'Gerenciar check-in',   desc: 'Controlar entrada/saída' },
]

type Membro = {
  id:     string
  status: string
  profiles:         { id: string; full_name: string | null } | null
  event_positions:  { id: string; name: string } | null
}

interface Props {
  eventoId: string
}

export function PainelEquipe({ eventoId }: Props) {
  const [membros,      setMembros]      = useState<Membro[]>([])
  const [loading,      setLoading]      = useState(true)
  const [adicionando,  setAdicionando]  = useState(false)
  const [linkCopiado,  setLinkCopiado]  = useState(false)
  const [salvando,     setSalvando]     = useState(false)
  const [removendo,    setRemovendo]    = useState<string | null>(null)
  const [err,          setErr]          = useState<string | null>(null)
  const [sucesso,      setSucesso]      = useState(false)

  const [email,        setEmail]        = useState('')
  const [cargo,        setCargo]        = useState('')
  const [permissoes,   setPermissoes]   = useState<string[]>(['validar_ingresso'])

  async function carregar() {
    setLoading(true)
    try {
      const res  = await fetch(`/api/eventos/${eventoId}/equipe`)
      const data = await res.json()
      setMembros(data.staff ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [eventoId])

  function togglePermissao(value: string) {
    setPermissoes(prev =>
      prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value]
    )
  }

  async function handleAdicionar() {
    if (!email.trim() || !cargo.trim()) {
      setErr('Email e cargo são obrigatórios')
      return
    }
    setSalvando(true)
    setErr(null)
    setSucesso(false)
    try {
      const res = await fetch(`/api/eventos/${eventoId}/equipe`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), positionName: cargo.trim(), permissions: permissoes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao adicionar')
      setSucesso(true)
      setEmail('')
      setCargo('')
      setPermissoes(['validar_ingresso'])
      setAdicionando(false)
      await carregar()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao adicionar')
    } finally {
      setSalvando(false)
    }
  }

  async function handleRemover(staffId: string) {
    setRemovendo(staffId)
    try {
      await fetch(`/api/eventos/${eventoId}/equipe?staffId=${staffId}`, { method: 'DELETE' })
      setMembros(prev => prev.filter(m => m.id !== staffId))
    } finally {
      setRemovendo(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Cabeçalho + botões */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={14} style={{ color: ACCENT }} />
          <span className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-outfit)' }}>
            Equipe do evento
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Link da bilheteria */}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/bilheteria/${eventoId}`)
              setLinkCopiado(true)
              setTimeout(() => setLinkCopiado(false), 2000)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background:  linkCopiado ? '#4ade8015' : '#111',
              border:      `1px solid ${linkCopiado ? '#4ade8040' : '#222'}`,
              color:       linkCopiado ? '#4ade80' : '#666',
              fontFamily:  'var(--font-dm-sans)',
            }}
            title="Copiar link da bilheteria para o vendedor"
          >
            {linkCopiado ? <Check size={12} /> : <Link2 size={12} />}
            {linkCopiado ? 'Copiado!' : 'Link bilheteria'}
          </button>

          {/* Link do scanner */}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/scanner/${eventoId}`)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: '#111',
              border:     '1px solid #222',
              color:      '#666',
              fontFamily: 'var(--font-dm-sans)',
            }}
            title="Copiar link do scanner para compartilhar com a equipe"
          >
            <Link2 size={12} />
            Link scanner
          </button>

          {!adicionando && (
            <button
              type="button"
              onClick={() => { setAdicionando(true); setErr(null); setSucesso(false) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#070707] transition-colors hover:brightness-110"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
            >
              <UserPlus size={12} />
              Adicionar
            </button>
          )}
        </div>
      </div>

      {/* Formulário de novo membro */}
      {adicionando && (
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ border: `1px solid ${ACCENT}30`, background: '#0d0d0d' }}>
          <p className="text-[#E8B84B] text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Novo membro
          </p>

          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email do usuário"
            className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          />

          <input
            type="text"
            value={cargo}
            onChange={e => setCargo(e.target.value)}
            placeholder="Cargo (ex: Segurança, Coordenador)"
            className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          />

          {/* Permissões */}
          <div>
            <p className="text-[#555] text-[10px] uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Permissões
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {PERMISSOES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePermissao(p.value)}
                  className="flex items-start gap-2 p-2.5 rounded-xl text-left transition-colors"
                  style={{
                    background: permissoes.includes(p.value) ? `${ACCENT}15` : '#111',
                    border:     `1px solid ${permissoes.includes(p.value) ? ACCENT + '40' : '#1e1e1e'}`,
                  }}
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: permissoes.includes(p.value) ? ACCENT : '#1a1a1a',
                      border:     `1px solid ${permissoes.includes(p.value) ? ACCENT : '#333'}`,
                    }}
                  >
                    {permissoes.includes(p.value) && <Check size={10} className="text-[#070707]" />}
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
          </div>

          {err && (
            <div className="flex items-center gap-2 text-red-400 text-xs py-2 px-3 rounded-lg bg-red-400/5">
              <AlertTriangle size={12} className="shrink-0" />
              {err}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setAdicionando(false); setErr(null) }}
              className="flex-1 py-2.5 rounded-xl text-xs text-[#444] border border-[#1e1e1e] hover:text-white hover:border-[#333] transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdicionar}
              disabled={salvando}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-[#070707] disabled:opacity-60"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
            >
              {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {salvando ? 'Adicionando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}

      {/* Feedback de sucesso */}
      {sucesso && (
        <div className="flex items-center gap-2 text-green-400 text-xs py-2 px-3 rounded-lg bg-green-400/5">
          <Check size={12} />
          Membro adicionado com sucesso!
        </div>
      )}

      {/* Lista de membros */}
      {loading ? (
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
            const profile  = m.profiles  as { full_name: string | null } | null
            const position = m.event_positions as { name: string } | null
            return (
              <div
                key={m.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
              >
                <div>
                  <p className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {profile?.full_name ?? 'Usuário'}
                  </p>
                  <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {position?.name ?? 'Sem cargo'}
                    <span
                      className="ml-2 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase"
                      style={{
                        background: m.status === 'active' ? '#4ade8015' : '#E8B84B15',
                        color:      m.status === 'active' ? '#4ade80'   : ACCENT,
                      }}
                    >
                      {m.status === 'active' ? 'Ativo' : 'Pendente'}
                    </span>
                  </p>
                </div>
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
            )
          })}
        </div>
      )}
    </div>
  )
}
