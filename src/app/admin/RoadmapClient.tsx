'use client'

import { useState, useCallback } from 'react'
import {
  Circle, Clock, CheckCircle2,
  ChevronUp, ChevronDown, Trash2, Plus, Save,
  Loader2,
} from 'lucide-react'

export type ItemStatus = 'pendente' | 'andamento' | 'feito'

export type RoadmapItem = {
  id:     string
  label:  string
  status: ItemStatus
  bloco:  string
}

export type RoadmapBloco = {
  id:     string
  titulo: string
  cor:    string
}

const BLOCOS: RoadmapBloco[] = [
  { id: 'andamento', titulo: 'Em andamento',           cor: '#E8B84B' },
  { id: 'sprint',    titulo: 'Próximo sprint',          cor: '#60a5fa' },
  { id: 'avancado',  titulo: 'Funcionalidades avançadas', cor: '#a78bfa' },
  { id: 'app',       titulo: 'App mobile e validação', cor: '#4ade80' },
  { id: 'educacao',  titulo: 'Educação e crescimento', cor: '#f472b6' },
  { id: 'concluido', titulo: 'Concluído',              cor: '#555'    },
]

const STATUS_CYCLE: ItemStatus[] = ['pendente', 'andamento', 'feito']

function nextStatus(s: ItemStatus): ItemStatus {
  const i = STATUS_CYCLE.indexOf(s)
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length]
}

function StatusIcon({ status, onClick }: { status: ItemStatus; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Clique para mudar o status"
      className="shrink-0 mt-0.5 hover:opacity-70 transition-opacity cursor-pointer"
    >
      {status === 'feito'     && <CheckCircle2 size={14} className="text-[#555]" />}
      {status === 'andamento' && <Clock        size={14} style={{ color: '#E8B84B' }} />}
      {status === 'pendente'  && <Circle       size={14} className="text-[#3a3a3a]" />}
    </button>
  )
}

function ItemRow({
  item, isFirst, isLast,
  onStatusCycle, onMoveUp, onMoveDown, onDelete, onChangeBloco,
}: {
  item:          RoadmapItem
  isFirst:       boolean
  isLast:        boolean
  onStatusCycle: () => void
  onMoveUp:      () => void
  onMoveDown:    () => void
  onDelete:      () => void
  onChangeBloco: (blocoId: string) => void
}) {
  const [showBlocoMenu, setShowBlocoMenu] = useState(false)

  return (
    <div className="group flex items-center gap-2 py-2 border-b border-[#0f0f0f] last:border-0">
      <StatusIcon status={item.status} onClick={onStatusCycle} />

      <p
        className="flex-1 text-sm leading-snug"
        style={{
          fontFamily:     'var(--font-dm-sans)',
          color:          item.status === 'feito' ? '#333' : item.status === 'andamento' ? '#bbb' : '#555',
          textDecoration: item.status === 'feito' ? 'line-through' : 'none',
        }}
      >
        {item.label}
      </p>

      {/* Controles — visíveis sempre em mobile, no hover em desktop */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">

        {/* Mover de bloco */}
        <div className="relative">
          <button
            onClick={() => setShowBlocoMenu(v => !v)}
            title="Mover para outro bloco"
            className="w-6 h-6 flex items-center justify-center rounded-lg text-[#333] hover:text-[#888] hover:bg-[#1a1a1a] transition-colors text-xs font-bold"
          >
            ↕
          </button>
          {showBlocoMenu && (
            <div
              className="absolute right-0 z-50 mt-1 rounded-xl overflow-hidden shadow-xl"
              style={{ background: '#111', border: '1px solid #222', minWidth: 200 }}
            >
              {BLOCOS.filter(b => b.id !== item.bloco).map(b => (
                <button
                  key={b.id}
                  onClick={() => { onChangeBloco(b.id); setShowBlocoMenu(false) }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#1a1a1a] transition-colors flex items-center gap-2"
                  style={{ fontFamily: 'var(--font-dm-sans)', color: '#aaa' }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.cor }} />
                  {b.titulo}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Subir */}
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          title="Mover para cima"
          className="w-6 h-6 flex items-center justify-center rounded-lg text-[#333] hover:text-[#888] hover:bg-[#1a1a1a] transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronUp size={12} />
        </button>

        {/* Descer */}
        <button
          onClick={onMoveDown}
          disabled={isLast}
          title="Mover para baixo"
          className="w-6 h-6 flex items-center justify-center rounded-lg text-[#333] hover:text-[#888] hover:bg-[#1a1a1a] transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronDown size={12} />
        </button>

        {/* Deletar */}
        <button
          onClick={onDelete}
          title="Remover item"
          className="w-6 h-6 flex items-center justify-center rounded-lg text-[#333] hover:text-red-500 hover:bg-[#1a1a1a] transition-colors"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

function AddItemRow({ blocoId, onAdd }: { blocoId: string; onAdd: (label: string, blocoId: string) => void }) {
  const [open, setOpen]     = useState(false)
  const [texto, setTexto]   = useState('')

  function submit() {
    const trimmed = texto.trim()
    if (!trimmed) return
    onAdd(trimmed, blocoId)
    setTexto('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 py-2 text-[#2a2a2a] hover:text-[#444] transition-colors"
      >
        <Plus size={12} />
        <span className="text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>Adicionar item</span>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 py-2">
      <input
        autoFocus
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') { setOpen(false); setTexto('') }
        }}
        placeholder="Descrição do item…"
        className="flex-1 bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-xs text-[#aaa] outline-none focus:border-[#333]"
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      />
      <button
        onClick={submit}
        className="text-xs px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: '#1a1a1a', color: '#888', fontFamily: 'var(--font-dm-sans)' }}
      >
        OK
      </button>
      <button
        onClick={() => { setOpen(false); setTexto('') }}
        className="text-xs text-[#333] hover:text-[#555]"
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      >
        ✕
      </button>
    </div>
  )
}

export default function RoadmapClient({ initialItems }: { initialItems: RoadmapItem[] }) {
  const [items, setItems]   = useState<RoadmapItem[]>(initialItems)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [dirty, setDirty]   = useState(false)

  const mutate = useCallback((fn: (prev: RoadmapItem[]) => RoadmapItem[]) => {
    setItems(fn)
    setDirty(true)
    setSaved(false)
  }, [])

  function cycleStatus(id: string) {
    mutate(prev => prev.map(i => i.id === id ? { ...i, status: nextStatus(i.status) } : i))
  }

  function moveUp(id: string, blocoId: string) {
    mutate(prev => {
      const blocoItems = prev.filter(i => i.bloco === blocoId)
      const idx = blocoItems.findIndex(i => i.id === id)
      if (idx <= 0) return prev
      const newBlocoItems = [...blocoItems]
      ;[newBlocoItems[idx - 1], newBlocoItems[idx]] = [newBlocoItems[idx], newBlocoItems[idx - 1]]
      const others = prev.filter(i => i.bloco !== blocoId)
      return [...others, ...newBlocoItems]
    })
  }

  function moveDown(id: string, blocoId: string) {
    mutate(prev => {
      const blocoItems = prev.filter(i => i.bloco === blocoId)
      const idx = blocoItems.findIndex(i => i.id === id)
      if (idx < 0 || idx >= blocoItems.length - 1) return prev
      const newBlocoItems = [...blocoItems]
      ;[newBlocoItems[idx], newBlocoItems[idx + 1]] = [newBlocoItems[idx + 1], newBlocoItems[idx]]
      const others = prev.filter(i => i.bloco !== blocoId)
      return [...others, ...newBlocoItems]
    })
  }

  function deleteItem(id: string) {
    mutate(prev => prev.filter(i => i.id !== id))
  }

  function changeBloco(id: string, blocoId: string) {
    mutate(prev => prev.map(i => i.id === id ? { ...i, bloco: blocoId } : i))
  }

  function addItem(label: string, blocoId: string) {
    const newItem: RoadmapItem = {
      id:     `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      status: 'pendente',
      bloco:  blocoId,
    }
    mutate(prev => [...prev, newItem])
  }

  async function save() {
    setSaving(true)
    try {
      await fetch('/api/admin/roadmap', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ items }),
      })
      setSaved(true)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Header com botão salvar */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            Lista de afazeres
          </h2>
          <p className="text-[#333] text-xs mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Clique no ícone de status para alterar · ↕ para mover de bloco · ▲▼ para reordenar
          </p>
        </div>

        <button
          onClick={save}
          disabled={saving || !dirty}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-30"
          style={{
            background:  saved && !dirty ? '#4ade8018' : '#E8B84B18',
            color:       saved && !dirty ? '#4ade80'   : '#E8B84B',
            border:      saved && !dirty ? '1px solid #4ade8030' : '1px solid #E8B84B30',
            fontFamily:  'var(--font-dm-sans)',
          }}
        >
          {saving
            ? <Loader2 size={14} className="animate-spin" />
            : <Save    size={14} />
          }
          {saving ? 'Salvando…' : saved && !dirty ? 'Salvo' : 'Salvar alterações'}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {BLOCOS.map(bloco => {
          const blocoItems = items.filter(i => i.bloco === bloco.id)
          return (
            <div key={bloco.id} className="rounded-2xl overflow-hidden" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
              {/* Header do bloco */}
              <div className="px-5 py-3.5 border-b border-[#141414] flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full" style={{ background: bloco.cor }} />
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {bloco.titulo}
                </p>
                <span
                  className="ml-auto text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: `${bloco.cor}18`, color: bloco.cor, fontFamily: 'var(--font-dm-sans)' }}
                >
                  {blocoItems.length}
                </span>
              </div>

              {/* Itens */}
              <div className="px-5 py-3 flex flex-col gap-0.5">
                {blocoItems.map((item, idx) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    isFirst={idx === 0}
                    isLast={idx === blocoItems.length - 1}
                    onStatusCycle={() => cycleStatus(item.id)}
                    onMoveUp={()    => moveUp(item.id, bloco.id)}
                    onMoveDown={()  => moveDown(item.id, bloco.id)}
                    onDelete={()    => deleteItem(item.id)}
                    onChangeBloco={id => changeBloco(item.id, id)}
                  />
                ))}
                <AddItemRow blocoId={bloco.id} onAdd={addItem} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
