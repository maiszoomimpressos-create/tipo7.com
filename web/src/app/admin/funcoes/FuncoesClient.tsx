'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Shield, Plus, Trash2, Loader2, Check, ChevronUp, ChevronDown,
  Pencil, X, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

const ACCENT = '#E8B84B'
const supabase = createClient()

const PERMISSOES = [
  { value: 'validar_ingresso',     label: 'Validar ingresso'     },
  { value: 'vender_ingresso',      label: 'Bilheteria'           },
  { value: 'ver_lista_convidados', label: 'Ver lista'            },
  { value: 'ver_relatorios',       label: 'Ver relatórios'       },
  { value: 'gerenciar_checkin',    label: 'Gerenciar check-in'   },
  { value: 'estacionamento_entrada', label: 'Estacionamento — Entrada' },
  { value: 'estacionamento_saida',   label: 'Estacionamento — Saída'   },
]

type Template = {
  id: string
  name: string
  active: boolean
  sort_order: number
  staff_function_template_permissions: { permission: string }[]
}

interface Props { funcoes: Template[] }

export function FuncoesClient({ funcoes: inicial }: Props) {
  const router = useRouter()
  const [funcoes,    setFuncoes]    = useState(inicial)
  const [criando,    setCriando]    = useState(false)
  const [editando,   setEditando]   = useState<Template | null>(null)
  const [nome,       setNome]       = useState('')
  const [perms,      setPerms]      = useState<string[]>([])
  const [salvando,   setSalvando]   = useState(false)
  const [removendo,  setRemovendo]  = useState<string | null>(null)
  const [err,        setErr]        = useState<string | null>(null)

  function togglePerm(v: string) {
    setPerms(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])
  }

  async function salvar() {
    if (!nome.trim()) { setErr('Nome é obrigatório'); return }
    setSalvando(true); setErr(null)
    try {
      if (editando) {
        await supabase.from('staff_function_templates').update({ name: nome.trim() }).eq('id', editando.id)
        await supabase.from('staff_function_template_permissions').delete().eq('template_id', editando.id)
        if (perms.length > 0) {
          await supabase.from('staff_function_template_permissions').insert(
            perms.map(p => ({ template_id: editando.id, permission: p }))
          )
        }
      } else {
        const maxOrder = funcoes.reduce((m, f) => Math.max(m, f.sort_order), 0)
        const { data: nova } = await supabase
          .from('staff_function_templates')
          .insert({ name: nome.trim(), sort_order: maxOrder + 1 })
          .select('id')
          .single()
        if (nova && perms.length > 0) {
          await supabase.from('staff_function_template_permissions').insert(
            perms.map(p => ({ template_id: nova.id, permission: p }))
          )
        }
      }
      router.refresh()
      setNome(''); setPerms([]); setCriando(false); setEditando(null)
    } catch { setErr('Erro ao salvar') }
    finally { setSalvando(false) }
  }

  async function remover(id: string) {
    setRemovendo(id)
    try {
      await supabase.from('staff_function_templates').delete().eq('id', id)
      setFuncoes(f => f.filter(x => x.id !== id))
    } finally { setRemovendo(null) }
  }

  async function toggleAtivo(f: Template) {
    await supabase.from('staff_function_templates').update({ active: !f.active }).eq('id', f.id)
    setFuncoes(prev => prev.map(x => x.id === f.id ? { ...x, active: !x.active } : x))
  }

  async function moverOrdem(f: Template, dir: 'up' | 'down') {
    const idx   = funcoes.findIndex(x => x.id === f.id)
    const outro = dir === 'up' ? funcoes[idx - 1] : funcoes[idx + 1]
    if (!outro) return
    await supabase.from('staff_function_templates').update({ sort_order: outro.sort_order }).eq('id', f.id)
    await supabase.from('staff_function_templates').update({ sort_order: f.sort_order }).eq('id', outro.id)
    const nova = [...funcoes]
    nova[idx] = { ...f, sort_order: outro.sort_order }
    nova[dir === 'up' ? idx - 1 : idx + 1] = { ...outro, sort_order: f.sort_order }
    setFuncoes(nova.sort((a, b) => a.sort_order - b.sort_order))
  }

  function iniciarEdicao(f: Template) {
    setEditando(f)
    setNome(f.name)
    setPerms(f.staff_function_template_permissions.map(p => p.permission))
    setCriando(true)
  }

  const permLabel: Record<string, string> = {
    validar_ingresso: 'Validar', vender_ingresso: 'Bilheteria',
    ver_lista_convidados: 'Ver lista', ver_relatorios: 'Relatórios',
    gerenciar_checkin: 'Check-in',
    estacionamento_entrada: 'Estac. entrada', estacionamento_saida: 'Estac. saída',
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Lista */}
      {funcoes.map((f, idx) => (
        <div
          key={f.id}
          className="rounded-2xl overflow-hidden"
          style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', opacity: f.active ? 1 : 0.5 }}
        >
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${ACCENT}12`, border: `1px solid ${ACCENT}20` }}
              >
                <Shield size={15} style={{ color: ACCENT }} />
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {f.name}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {f.staff_function_template_permissions.length === 0 ? (
                    <span className="text-[#333] text-[10px]">Sem permissões</span>
                  ) : f.staff_function_template_permissions.map(p => (
                    <span
                      key={p.permission}
                      className="px-1.5 py-0.5 rounded text-[10px]"
                      style={{ background: `${ACCENT}10`, color: '#888', fontFamily: 'var(--font-dm-sans)' }}
                    >
                      {permLabel[p.permission] ?? p.permission}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => moverOrdem(f, 'up')} disabled={idx === 0}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 disabled:opacity-20 transition-colors">
                <ChevronUp size={13} className="text-[#555]" />
              </button>
              <button type="button" onClick={() => moverOrdem(f, 'down')} disabled={idx === funcoes.length - 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 disabled:opacity-20 transition-colors">
                <ChevronDown size={13} className="text-[#555]" />
              </button>
              <button type="button" onClick={() => toggleAtivo(f)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
                title={f.active ? 'Desativar' : 'Ativar'}>
                {f.active
                  ? <ToggleRight size={16} style={{ color: ACCENT }} />
                  : <ToggleLeft  size={16} className="text-[#444]" />
                }
              </button>
              <button type="button" onClick={() => iniciarEdicao(f)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors">
                <Pencil size={13} className="text-[#444] hover:text-white" />
              </button>
              <button type="button" onClick={() => remover(f.id)} disabled={removendo === f.id}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40">
                {removendo === f.id
                  ? <Loader2 size={13} className="text-[#444] animate-spin" />
                  : <Trash2  size={13} className="text-[#444] hover:text-red-400" />
                }
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Formulário criar/editar */}
      {criando ? (
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ border: `1px solid ${ACCENT}30`, background: '#0d0d0d' }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
              {editando ? 'Editar função' : 'Nova função'}
            </p>
            <button type="button" onClick={() => { setCriando(false); setEditando(null); setNome(''); setPerms([]) }}>
              <X size={14} className="text-[#444] hover:text-white" />
            </button>
          </div>

          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Nome da função (ex: Segurança, Coordenador)"
            className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          />

          <div>
            <p className="text-[#555] text-[10px] uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Permissões padrão
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {PERMISSOES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePerm(p.value)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors"
                  style={{
                    background: perms.includes(p.value) ? `${ACCENT}15` : '#111',
                    border: `1px solid ${perms.includes(p.value) ? ACCENT + '40' : '#1e1e1e'}`,
                  }}
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                    style={{
                      background: perms.includes(p.value) ? ACCENT : '#1a1a1a',
                      border: `1px solid ${perms.includes(p.value) ? ACCENT : '#333'}`,
                    }}
                  >
                    {perms.includes(p.value) && <Check size={10} className="text-[#070707]" />}
                  </div>
                  <span className="text-white text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {err && <p className="text-red-400 text-xs">{err}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setCriando(false); setEditando(null); setNome(''); setPerms([]) }}
              className="flex-1 py-2.5 rounded-xl text-xs text-[#444] border border-[#1e1e1e] hover:text-white transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-[#070707] disabled:opacity-60"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
            >
              {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {editando ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setCriando(true); setEditando(null); setNome(''); setPerms([]) }}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm transition-colors hover:border-[#333] hover:text-white"
          style={{ border: '1px dashed #222', color: '#444', fontFamily: 'var(--font-dm-sans)' }}
        >
          <Plus size={14} />
          Nova função
        </button>
      )}
    </div>
  )
}
