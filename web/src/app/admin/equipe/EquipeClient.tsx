'use client'

import { useState } from 'react'
import { UserPlus, Trash2, Loader2, Check, Shield, AlertTriangle } from 'lucide-react'

const ACCENT = '#E8B84B'

const PERMISSOES = [
  { value: 'ver_dashboard',        label: 'Ver dashboard'       },
  { value: 'gerenciar_promotores', label: 'Gerenciar promotores' },
  { value: 'gerenciar_eventos',    label: 'Gerenciar eventos'    },
  { value: 'gerenciar_financeiro', label: 'Gerenciar financeiro' },
]

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  member:      'Membro',
}
const ROLE_COLOR: Record<string, string> = {
  super_admin: '#f472b6',
  admin:       '#E8B84B',
  member:      '#60a5fa',
}

type Row = {
  id:          string
  userId:      string
  nome:        string
  role:        string
  permissions: string[]
  createdAt:   string
  isMe:        boolean
}

interface Props {
  rows:         Row[]
  isSuperAdmin: boolean
}

export function EquipeClient({ rows: initial, isSuperAdmin }: Props) {
  const [rows,       setRows]       = useState(initial)
  const [adicionando, setAdicionando] = useState(false)
  const [email,      setEmail]      = useState('')
  const [role,       setRole]       = useState('member')
  const [perms,      setPerms]      = useState<string[]>(['ver_dashboard'])
  const [salvando,   setSalvando]   = useState(false)
  const [removendo,  setRemovendo]  = useState<string | null>(null)
  const [err,        setErr]        = useState<string | null>(null)
  const [sucesso,    setSucesso]    = useState(false)

  function togglePerm(p: string) {
    setPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  async function handleAdicionar() {
    if (!email.trim()) { setErr('Email é obrigatório'); return }
    setSalvando(true); setErr(null); setSucesso(false)
    try {
      const res  = await fetch('/api/admin/equipe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), role, permissions: role === 'admin' ? [] : perms }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao adicionar')
      setRows(prev => [...prev, data.member])
      setSucesso(true)
      setEmail(''); setRole('member'); setPerms(['ver_dashboard'])
      setAdicionando(false)
      setTimeout(() => setSucesso(false), 3000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao adicionar')
    } finally {
      setSalvando(false)
    }
  }

  async function handleRemover(id: string) {
    setRemovendo(id)
    try {
      await fetch(`/api/admin/equipe?memberId=${id}`, { method: 'DELETE' })
      setRows(prev => prev.filter(r => r.id !== id))
    } finally {
      setRemovendo(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Botão adicionar */}
      {isSuperAdmin && !adicionando && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { setAdicionando(true); setErr(null) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#070707]"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
          >
            <UserPlus size={14} /> Adicionar membro
          </button>
        </div>
      )}

      {/* Formulário */}
      {adicionando && (
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: '#0d0d0d', border: `1px solid ${ACCENT}30` }}>
          <p className="text-[#E8B84B] text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Novo membro
          </p>

          <input
            type="email"
            placeholder="Email do usuário"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          />

          {/* Nível de acesso */}
          <div>
            <p className="text-[#555] text-[10px] uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Nível de acesso
            </p>
            <div className="flex gap-2">
              {(['admin', 'member'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: role === r ? `${ROLE_COLOR[r]}20` : '#111',
                    border:     `1px solid ${role === r ? ROLE_COLOR[r] + '60' : '#222'}`,
                    color:      role === r ? ROLE_COLOR[r] : '#555',
                    fontFamily: 'var(--font-dm-sans)',
                  }}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
            {role === 'admin' && (
              <p className="text-[#444] text-xs mt-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Admin tem acesso total exceto gerenciar a equipe.
              </p>
            )}
          </div>

          {/* Permissões (só para member) */}
          {role === 'member' && (
            <div>
              <p className="text-[#555] text-[10px] uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Permissões
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {PERMISSOES.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => togglePerm(p.value)}
                    className="flex items-center gap-2 p-2.5 rounded-xl text-left transition-all"
                    style={{
                      background: perms.includes(p.value) ? `${ACCENT}15` : '#111',
                      border:     `1px solid ${perms.includes(p.value) ? ACCENT + '40' : '#1e1e1e'}`,
                    }}
                  >
                    <div className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                         style={{ background: perms.includes(p.value) ? ACCENT : '#1a1a1a', border: `1px solid ${perms.includes(p.value) ? ACCENT : '#333'}` }}>
                      {perms.includes(p.value) && <Check size={10} className="text-[#070707]" />}
                    </div>
                    <span className="text-white text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {err && (
            <div className="flex items-center gap-2 text-red-400 text-xs py-2 px-3 rounded-lg bg-red-400/5">
              <AlertTriangle size={12} /> {err}
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => { setAdicionando(false); setErr(null) }}
              className="flex-1 py-2.5 rounded-xl text-xs text-[#444] border border-[#1e1e1e] hover:text-white transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Cancelar
            </button>
            <button type="button" onClick={handleAdicionar} disabled={salvando}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-[#070707] disabled:opacity-60"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
              {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {salvando ? 'Adicionando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}

      {sucesso && (
        <div className="flex items-center gap-2 text-green-400 text-xs py-2 px-3 rounded-lg bg-green-400/5">
          <Check size={12} /> Membro adicionado com sucesso!
        </div>
      )}

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {rows.map(row => (
          <div key={row.id} className="flex items-center justify-between px-5 py-4 rounded-2xl"
               style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-[#070707] shrink-0"
                   style={{ background: ROLE_COLOR[row.role] ?? ACCENT, fontFamily: 'var(--font-syne)' }}>
                {row.nome.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {row.nome}
                  </p>
                  {row.isMe && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold"
                          style={{ background: '#1a1a1a', color: '#555', fontFamily: 'var(--font-dm-sans)' }}>
                      você
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-semibold" style={{ color: ROLE_COLOR[row.role], fontFamily: 'var(--font-dm-sans)' }}>
                    {ROLE_LABEL[row.role] ?? row.role}
                  </span>
                  {row.role === 'member' && row.permissions.length > 0 && (
                    <span className="text-[#333] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      · {row.permissions.length} permissão(ões)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {isSuperAdmin && !row.isMe && row.role !== 'super_admin' && (
              <button type="button" onClick={() => handleRemover(row.id)} disabled={removendo === row.id}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#1a1a1a] transition-colors disabled:opacity-40">
                {removendo === row.id
                  ? <Loader2 size={14} className="text-[#444] animate-spin" />
                  : <Trash2  size={14} className="text-[#444] hover:text-red-400 transition-colors" />
                }
              </button>
            )}
            {(row.isMe || row.role === 'super_admin') && (
              <Shield size={14} className="text-[#222]" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
