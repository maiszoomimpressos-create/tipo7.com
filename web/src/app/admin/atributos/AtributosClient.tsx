'use client'

import { useState } from 'react'
import {
  Shield, Car, UtensilsCrossed, Beer, Accessibility, Wifi,
  Baby, HeartPulse, Cigarette, Camera, Tag,
  Plus, Loader2, Check, Trash2, Eye, EyeOff, ChevronUp, ChevronDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { LucideIcon } from 'lucide-react'

const ACCENT = '#E8B84B'

// Ícones disponíveis para seleção ao criar um novo atributo
const ICON_OPTIONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'Shield',          label: 'Segurança',     icon: Shield          },
  { key: 'Car',             label: 'Carro',         icon: Car             },
  { key: 'UtensilsCrossed', label: 'Alimentação',   icon: UtensilsCrossed },
  { key: 'Beer',            label: 'Bar',           icon: Beer            },
  { key: 'Accessibility',   label: 'Acessível',     icon: Accessibility   },
  { key: 'Wifi',            label: 'Wi-Fi',         icon: Wifi            },
  { key: 'Baby',            label: 'Infantil',      icon: Baby            },
  { key: 'HeartPulse',      label: 'Médico',        icon: HeartPulse      },
  { key: 'Cigarette',       label: 'Fumantes',      icon: Cigarette       },
  { key: 'Camera',          label: 'Fotos',         icon: Camera          },
  { key: 'Tag',             label: 'Genérico',      icon: Tag             },
]

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_OPTIONS.map(o => [o.key, o.icon])
)

interface Atributo {
  id:          string
  name:        string
  icon:        string
  active:      boolean
  order_index: number
}

interface Props {
  atributos: Atributo[]
}

export function AtributosClient({ atributos: initialAtributos }: Props) {
  const [atributos,    setAtributos]    = useState<Atributo[]>(initialAtributos)
  const [showForm,     setShowForm]     = useState(false)
  const [novoNome,     setNovoNome]     = useState('')
  const [novoIcone,    setNovoIcone]    = useState('Tag')
  const [criando,      setCriando]      = useState(false)
  const [erroForm,     setErroForm]     = useState<string | null>(null)
  const [toggling,     setToggling]     = useState<string | null>(null)
  const [excluindo,    setExcluindo]    = useState<string | null>(null)
  const [confirmDel,   setConfirmDel]   = useState<string | null>(null)
  const [reordering,   setReordering]   = useState<string | null>(null)

  async function handleCriar() {
    if (!novoNome.trim()) { setErroForm('Informe o nome do atributo'); return }
    setCriando(true); setErroForm(null)
    const supabase = createClient()
    const nextOrder = (atributos.at(-1)?.order_index ?? 0) + 1
    const { data, error } = await supabase
      .from('event_attributes')
      .insert({ name: novoNome.trim(), icon: novoIcone, order_index: nextOrder })
      .select('id, name, icon, active, order_index')
      .single()

    if (error || !data) {
      setErroForm('Erro ao criar atributo. Verifique suas permissões.')
    } else {
      setAtributos(prev => [...prev, data as Atributo])
      setNovoNome(''); setNovoIcone('Tag'); setShowForm(false)
    }
    setCriando(false)
  }

  async function handleToggleAtivo(attr: Atributo) {
    setToggling(attr.id)
    const supabase = createClient()
    const { error } = await supabase
      .from('event_attributes')
      .update({ active: !attr.active })
      .eq('id', attr.id)

    if (!error) {
      setAtributos(prev => prev.map(a => a.id === attr.id ? { ...a, active: !a.active } : a))
    }
    setToggling(null)
  }

  async function handleExcluir(id: string) {
    setExcluindo(id); setConfirmDel(null)
    const supabase = createClient()
    const { error } = await supabase.from('event_attributes').delete().eq('id', id)
    if (!error) {
      setAtributos(prev => prev.filter(a => a.id !== id))
    }
    setExcluindo(null)
  }

  // Move um atributo para cima ou para baixo trocando order_index com o vizinho
  async function handleMover(id: string, direcao: 'up' | 'down') {
    const idx    = atributos.findIndex(a => a.id === id)
    const vizIdx = direcao === 'up' ? idx - 1 : idx + 1
    if (vizIdx < 0 || vizIdx >= atributos.length) return

    setReordering(id)
    const atual = atributos[idx]
    const viz   = atributos[vizIdx]
    const supabase = createClient()

    // Troca os order_index dos dois
    await Promise.all([
      supabase.from('event_attributes').update({ order_index: viz.order_index  }).eq('id', atual.id),
      supabase.from('event_attributes').update({ order_index: atual.order_index }).eq('id', viz.id),
    ])

    setAtributos(prev => {
      const novo = [...prev]
      novo[idx]    = { ...atual, order_index: viz.order_index  }
      novo[vizIdx] = { ...viz,   order_index: atual.order_index }
      return novo.sort((a, b) => a.order_index - b.order_index)
    })
    setReordering(null)
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Botão para abrir formulário de criação */}
      {!showForm && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { setShowForm(true); setErroForm(null) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#070707]"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
          >
            <Plus size={14} /> Novo atributo
          </button>
        </div>
      )}

      {/* Formulário de criação inline */}
      {showForm && (
        <div
          className="rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: '#0d0d0d', border: `1px solid ${ACCENT}30` }}
        >
          <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            Novo atributo
          </p>

          {/* Nome */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Nome
            </label>
            <input
              type="text"
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              maxLength={60}
              placeholder="ex.: Estacionamento gratuito"
              className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#333]"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
              autoFocus
            />
          </div>

          {/* Seleção de ícone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Ícone
            </label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setNovoIcone(key)}
                  title={label}
                  className="flex flex-col items-center gap-1 w-14 py-2 rounded-xl border transition-all"
                  style={{
                    background: novoIcone === key ? `${ACCENT}15` : '#111',
                    border:     `1px solid ${novoIcone === key ? ACCENT + '50' : '#222'}`,
                  }}
                >
                  <Icon size={16} style={{ color: novoIcone === key ? ACCENT : '#555' }} />
                  <span className="text-[9px] text-[#555]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {erroForm && (
            <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {erroForm}
            </p>
          )}

          {/* Ações */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCriar}
              disabled={criando}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-60"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
            >
              {criando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Criar
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setNovoNome(''); setNovoIcone('Tag'); setErroForm(null) }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-[#555] hover:text-white border border-[#222] hover:border-[#333] transition-all"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de atributos existentes */}
      <div className="flex flex-col gap-2">
        {atributos.length === 0 && (
          <p className="text-[#444] text-sm text-center py-8" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Nenhum atributo cadastrado.
          </p>
        )}
        {atributos.map((attr, i) => {
          const Icon = ICON_MAP[attr.icon] ?? Tag
          const isLast = i === atributos.length - 1
          return (
            <div
              key={attr.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border"
              style={{
                background: '#0d0d0d',
                border:     `1px solid ${attr.active ? '#1e1e1e' : '#141414'}`,
                opacity:    attr.active ? 1 : 0.55,
              }}
            >
              {/* Ícone */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: attr.active ? `${ACCENT}15` : '#111' }}
              >
                <Icon size={14} style={{ color: attr.active ? ACCENT : '#444' }} />
              </div>

              {/* Nome + status */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {attr.name}
                </p>
                <p className="text-[#444] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {attr.active ? 'Visível aos promotores' : 'Oculto'}
                </p>
              </div>

              {/* Controles de ordem */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleMover(attr.id, 'up')}
                  disabled={i === 0 || reordering === attr.id}
                  className="w-5 h-5 rounded flex items-center justify-center text-[#333] hover:text-[#888] disabled:opacity-20 transition-colors"
                  title="Mover para cima"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleMover(attr.id, 'down')}
                  disabled={isLast || reordering === attr.id}
                  className="w-5 h-5 rounded flex items-center justify-center text-[#333] hover:text-[#888] disabled:opacity-20 transition-colors"
                  title="Mover para baixo"
                >
                  <ChevronDown size={12} />
                </button>
              </div>

              {/* Toggle ativo/inativo */}
              <button
                type="button"
                onClick={() => handleToggleAtivo(attr)}
                disabled={toggling === attr.id}
                title={attr.active ? 'Desativar' : 'Ativar'}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0"
                style={{
                  background: attr.active ? 'rgba(232,184,75,0.08)' : '#111',
                  border:     `1px solid ${attr.active ? ACCENT + '30' : '#1e1e1e'}`,
                }}
              >
                {toggling === attr.id
                  ? <Loader2 size={12} className="animate-spin text-[#444]" />
                  : attr.active
                    ? <Eye    size={12} style={{ color: ACCENT }} />
                    : <EyeOff size={12} className="text-[#333]" />
                }
              </button>

              {/* Excluir com confirmação em dois cliques */}
              {confirmDel === attr.id ? (
                <button
                  type="button"
                  onClick={() => handleExcluir(attr.id)}
                  disabled={excluindo === attr.id}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition-all"
                  style={{ background: '#3f0a0a', color: '#f87171', border: '1px solid #5c1a1a', fontFamily: 'var(--font-dm-sans)' }}
                >
                  {excluindo === attr.id
                    ? <Loader2 size={11} className="animate-spin" />
                    : <><Trash2 size={11} /> Confirmar</>
                  }
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDel(attr.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#2a2a2a] hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0"
                  title="Excluir"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
