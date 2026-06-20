'use client'

// Painel admin — sidebar de navegação + Listas de Tarefas + Bloco de Ideias
// Seletor de lista usa checkboxes (multi-seleção): uma ideia pode ir para várias listas
import { useState, useEffect, useRef } from 'react'
import {
  CheckCircle2, Circle, Lightbulb, Plus, Trash2,
  ClipboardList, X, FolderPlus, Check,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type TaskList = {
  id:        string
  name:      string
  isDefault: boolean
}

type Task = {
  id:     string
  label:  string
  done:   boolean
  listId: string
}

type Idea = {
  id:         string
  text:       string
  createdAt:  string
  listIds:    string[]
  listNames:  string[]
}

// ---------------------------------------------------------------------------
// Dados iniciais
// ---------------------------------------------------------------------------

const DEFAULT_LISTS: TaskList[] = [
  { id: 'comprador', name: 'Comprador',        isDefault: true },
  { id: 'pf',       name: 'Promotor PF',       isDefault: true },
  { id: 'pj',       name: 'Promotor PJ',       isDefault: true },
  { id: 'staff',    name: 'Validação (Staff)', isDefault: true },
  { id: 'platform', name: 'Plataforma',        isDefault: true },
]

const INITIAL_TASKS: Omit<Task, 'done'>[] = [
  { id: 'c1', listId: 'comprador', label: 'Página pública do evento /evento/[id]' },
  { id: 'c2', listId: 'comprador', label: 'Seleção de ingressos com +/− quantidade' },
  { id: 'c3', listId: 'comprador', label: 'Checkout Mercado Pago (pagamentos reais)' },
  { id: 'c4', listId: 'comprador', label: 'Páginas de retorno: sucesso, falha, pendente' },
  { id: 'c5', listId: 'comprador', label: 'Página "Meus Ingressos" /meus-ingressos' },
  { id: 'c6', listId: 'comprador', label: 'QR Code gerado após pagamento aprovado' },
  { id: 'c7', listId: 'comprador', label: 'Email com QR Code (Resend)' },
  { id: 'p1', listId: 'pf', label: 'Cadastro e login' },
  { id: 'p2', listId: 'pf', label: 'Perfil completo (dados pessoais + endereço)' },
  { id: 'p3', listId: 'pf', label: 'Criar evento — Etapa 1: Informações' },
  { id: 'p4', listId: 'pf', label: 'Criar evento — Etapa 2: Ingressos' },
  { id: 'p5', listId: 'pf', label: 'Criar evento — Etapa 3: Imagens' },
  { id: 'p6', listId: 'pf', label: 'Criar evento — Etapa 4: Publicar' },
  { id: 'p7', listId: 'pf', label: 'Gerenciamento de eventos (rascunhos + publicados)' },
  { id: 'p8', listId: 'pf', label: 'Dashboard de vendas do evento' },
  { id: 'p9', listId: 'pf', label: 'Lista de compradores por evento' },
  { id: 'j1', listId: 'pj', label: 'Cadastro PJ (CNPJ, Razão Social, Nome Fantasia)' },
  { id: 'j2', listId: 'pj', label: 'Perfil da organização/empresa' },
  { id: 'j3', listId: 'pj', label: 'Vincular eventos à empresa (PJ)' },
  { id: 'v1', listId: 'staff', label: 'Página do scanner /scanner/[eventoId]' },
  { id: 'v2', listId: 'staff', label: 'Leitura de QR Code pela câmera' },
  { id: 'v3', listId: 'staff', label: 'Validação 6 camadas (token, uso único, device, push)' },
  { id: 'v4', listId: 'staff', label: 'Feedback visual: aprovado / negado / já usado' },
  { id: 'l1', listId: 'platform', label: 'Landing page (carrossel + grade + PromoterCTA + Footer)' },
  { id: 'l2', listId: 'platform', label: 'Deploy tipo7.com (Vercel + DNS)' },
  { id: 'l3', listId: 'platform', label: 'Painel admin master /admin' },
  { id: 'l4', listId: 'platform', label: 'Filtros de categoria na landing page' },
  { id: 'l5', listId: 'platform', label: 'Barra de busca de eventos' },
  { id: 'l6', listId: 'platform', label: 'Remover dados de teste (eventos_exemplo.sql)' },
]

const DONE_BY_DEFAULT = new Set([
  'c1','c2','c3','c4','p1','p2','p3','p4','p5','p6','p7','l1','l2',
])

// ---------------------------------------------------------------------------
// Seletor de lista com checkboxes (multi-seleção)
// ---------------------------------------------------------------------------

function ListSelector({
  lists,
  selected,
  onChange,
  onCreateList,
}: {
  lists:        TaskList[]
  selected:     string[]
  onChange:     (ids: string[]) => void
  onCreateList: (name: string) => string
}) {
  const [open,     setOpen]     = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName,  setNewName]  = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setNewName('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter(s => s !== id)
        : [...selected, id]
    )
  }

  function handleCreate() {
    const name = newName.trim()
    if (!name) return
    const id = onCreateList(name)
    onChange([...selected, id])
    setCreating(false)
    setNewName('')
  }

  const label = selected.length === 0
    ? 'Selecionar lista(s)…'
    : selected.length === 1
      ? lists.find(l => l.id === selected[0])?.name ?? '1 lista'
      : `${selected.length} listas selecionadas`

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setCreating(false) }}
        className="w-full flex items-center justify-between gap-2 bg-[#070707] border border-[#1a1a1a] rounded-xl px-4 py-2.5 text-sm text-left hover:border-[#2a2a2a] transition-colors focus:outline-none focus:border-[#E8B84B]/40"
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      >
        <span className={selected.length > 0 ? 'text-white' : 'text-[#333]'}>{label}</span>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange([]) }}
              className="text-[#444] hover:text-white transition-colors"
            >
              <X size={13} />
            </button>
          )}
          <span className="text-[#444] text-[10px]">▼</span>
        </div>
      </button>

      {open && (
        <div className="absolute z-20 top-[calc(100%+6px)] left-0 right-0 bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl overflow-hidden shadow-xl shadow-black/60">

          {/* Nenhuma lista */}
          <button
            type="button"
            onClick={() => { onChange([]); setOpen(false) }}
            className="w-full px-4 py-2.5 text-sm text-left text-[#444] hover:text-white hover:bg-white/5 transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Nenhuma (só salvar como nota)
          </button>

          <div className="h-px bg-[#1a1a1a]" />

          {/* Listas com checkbox */}
          {lists.map(list => {
            const checked = selected.includes(list.id)
            return (
              <button
                key={list.id}
                type="button"
                onClick={() => toggle(list.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-white/5 transition-colors"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                {/* Checkbox visual */}
                <span className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                  checked
                    ? 'bg-[#E8B84B] border-[#E8B84B]'
                    : 'border-[#2a2a2a] bg-transparent'
                }`}>
                  {checked && <Check size={10} className="text-[#070707]" strokeWidth={3} />}
                </span>
                <span className={checked ? 'text-[#E8B84B]' : 'text-[#bbb]'}>
                  {list.name}
                </span>
              </button>
            )
          })}

          <div className="h-px bg-[#1a1a1a]" />

          {/* Criar nova lista */}
          {creating ? (
            <div className="p-3 flex gap-2">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') setCreating(false)
                }}
                placeholder="Nome da lista…"
                className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white placeholder-[#333] focus:outline-none focus:border-[#E8B84B]/40"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-3 py-1.5 bg-[#E8B84B] text-[#070707] text-xs font-semibold rounded-lg disabled:opacity-30"
              >
                Criar
              </button>
              <button type="button" onClick={() => setCreating(false)} className="text-[#444] hover:text-white">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#E8B84B] hover:bg-[#E8B84B]/5 transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              <FolderPlus size={14} />
              Nova lista…
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

type Tab = 'checklist' | 'ideias'

export function AdminClient() {
  const [tab,   setTab]   = useState<Tab>('checklist')
  const [lists, setLists] = useState<TaskList[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])

  const [draft,        setDraft]        = useState('')
  const [selectedIds,  setSelectedIds]  = useState<string[]>([])

  // --------------- carrega localStorage ---------------
  useEffect(() => {
    const savedLists = localStorage.getItem('admin_lists')
    const savedTasks = localStorage.getItem('admin_tasks_v2')
    const savedIdeas = localStorage.getItem('admin_ideas_v2')

    setLists(savedLists ? JSON.parse(savedLists) : DEFAULT_LISTS)
    setTasks(savedTasks ? JSON.parse(savedTasks) : INITIAL_TASKS.map(t => ({ ...t, done: DONE_BY_DEFAULT.has(t.id) })))
    setIdeas(savedIdeas ? JSON.parse(savedIdeas) : [])
  }, [])

  useEffect(() => { if (lists.length > 0) localStorage.setItem('admin_lists',    JSON.stringify(lists)) }, [lists])
  useEffect(() => { if (tasks.length > 0) localStorage.setItem('admin_tasks_v2', JSON.stringify(tasks)) }, [tasks])
  useEffect(() => {                        localStorage.setItem('admin_ideas_v2', JSON.stringify(ideas)) }, [ideas])

  function createList(name: string): string {
    const id = crypto.randomUUID()
    setLists(prev => [...prev, { id, name, isDefault: false }])
    return id
  }

  function toggleTask(id: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  function saveIdea() {
    const text = draft.trim()
    if (!text) return

    const targetLists = lists.filter(l => selectedIds.includes(l.id))

    const idea: Idea = {
      id:        crypto.randomUUID(),
      text,
      createdAt: new Date().toLocaleDateString('pt-BR'),
      listIds:   targetLists.map(l => l.id),
      listNames: targetLists.map(l => l.name),
    }

    setIdeas(prev => [idea, ...prev])

    // Cria uma tarefa em cada lista selecionada
    if (targetLists.length > 0) {
      const newTasks: Task[] = targetLists.map(list => ({
        id:     crypto.randomUUID(),
        label:  text,
        done:   false,
        listId: list.id,
      }))
      setTasks(prev => [...prev, ...newTasks])
    }

    setDraft('')
    setSelectedIds([])
  }

  function removeIdea(id: string) {
    setIdeas(prev => prev.filter(i => i.id !== id))
  }

  // Métricas gerais
  const total = tasks.length
  const done  = tasks.filter(t => t.done).length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const NAV: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'checklist', label: 'Listas',  icon: <ClipboardList size={16} /> },
    { key: 'ideias',    label: 'Ideias',  icon: <Lightbulb     size={16} /> },
  ]

  return (
    <div className="flex gap-5 items-start">

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-48 shrink-0 sticky top-[80px]">
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">

          <div className="px-4 py-3 border-b border-[#1a1a1a]">
            <p className="text-[#333] text-[11px] uppercase tracking-widest" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Navegação
            </p>
          </div>

          <nav className="p-2 flex flex-col gap-0.5">
            {NAV.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${
                  tab === key
                    ? 'bg-[#E8B84B]/12 text-[#E8B84B] font-medium'
                    : 'text-[#555] hover:text-white hover:bg-white/5'
                }`}
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                {icon}
                {label}
              </button>
            ))}
          </nav>

          {/* Progresso resumido na sidebar */}
          <div className="px-4 pb-4 pt-1 border-t border-[#131313] mt-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[#333] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>MVP</span>
              <span className="text-[#E8B84B] text-[11px] font-semibold" style={{ fontFamily: 'var(--font-syne)' }}>{pct}%</span>
            </div>
            <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#E8B84B] rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[#2a2a2a] text-[10px] mt-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {done} de {total} tarefas
            </p>
          </div>
        </div>
      </aside>

      {/* ── Conteúdo principal ───────────────────────────────────── */}
      <div className="flex-1 min-w-0">

        {/* ============================================================
            ABA: LISTAS DE TAREFAS
           ============================================================ */}
        {tab === 'checklist' && (
          <div className="space-y-4">
            {lists.map(list => {
              const items     = tasks.filter(t => t.listId === list.id)
              const listDone  = items.filter(t => t.done).length
              const listTotal = items.length
              if (listTotal === 0 && !list.isDefault) return null

              return (
                <div key={list.id} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1a1a1a]">
                    <span className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-outfit)' }}>
                      {list.name}
                    </span>
                    <span className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {listDone}/{listTotal}
                    </span>
                  </div>

                  {listTotal === 0 ? (
                    <p className="px-5 py-4 text-[#2a2a2a] text-sm italic" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      Nenhuma tarefa — adicione via Ideias.
                    </p>
                  ) : (
                    <ul className="divide-y divide-[#131313]">
                      {items.map(task => (
                        <li key={task.id} className="group">
                          <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#111] transition-colors">
                            <button onClick={() => toggleTask(task.id)} className="shrink-0">
                              {task.done
                                ? <CheckCircle2 size={18} className="text-[#E8B84B]" />
                                : <Circle       size={18} className="text-[#2a2a2a]" />
                              }
                            </button>
                            <span
                              className={`flex-1 text-sm leading-snug transition-colors ${
                                task.done ? 'text-[#444] line-through' : 'text-[#ccc]'
                              }`}
                              style={{ fontFamily: 'var(--font-dm-sans)' }}
                            >
                              {task.label}
                            </span>
                            {!list.isDefault && (
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="text-[#2a2a2a] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ============================================================
            ABA: BLOCO DE IDEIAS
           ============================================================ */}
        {tab === 'ideias' && (
          <div>
            {/* Formulário */}
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-5 mb-4">
              <p className="text-[#555] text-xs mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Escreva uma ideia e selecione em quais listas ela deve entrar como tarefa.
                Uma ideia pode ir para várias listas ao mesmo tempo.
              </p>

              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveIdea() }}
                placeholder="Escreva sua ideia aqui…"
                rows={3}
                className="w-full bg-[#070707] border border-[#1a1a1a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#333] resize-none focus:outline-none focus:border-[#E8B84B]/40 transition-colors mb-3"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />

              <ListSelector
                lists={lists}
                selected={selectedIds}
                onChange={setSelectedIds}
                onCreateList={createList}
              />

              <div className="flex items-center justify-between mt-3">
                <span className="text-[#2a2a2a] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Ctrl + Enter para salvar
                </span>
                <button
                  onClick={saveIdea}
                  disabled={!draft.trim()}
                  className="flex items-center gap-2 bg-[#E8B84B] text-[#070707] text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#d4a73e] transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                >
                  <Plus size={15} />
                  {selectedIds.length > 0
                    ? `Salvar e adicionar a ${selectedIds.length > 1 ? `${selectedIds.length} listas` : '1 lista'}`
                    : 'Salvar ideia'
                  }
                </button>
              </div>
            </div>

            {/* Lista de ideias */}
            {ideas.length === 0 ? (
              <div className="text-center py-16">
                <Lightbulb size={32} className="text-[#1a1a1a] mx-auto mb-3" />
                <p className="text-[#333] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Nenhuma ideia salva ainda.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {ideas.map(idea => (
                  <div
                    key={idea.id}
                    className="group flex items-start gap-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl px-5 py-4 hover:border-[#222] transition-colors"
                  >
                    <Lightbulb size={15} className="text-[#E8B84B] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#bbb] leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {idea.text}
                      </p>
                      {/* Tags das listas vinculadas */}
                      {idea.listNames.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {idea.listNames.map(name => (
                            <span
                              key={name}
                              className="inline-block px-2 py-0.5 rounded-md text-[11px] bg-[#E8B84B]/10 text-[#E8B84B]/70 border border-[#E8B84B]/15"
                              style={{ fontFamily: 'var(--font-dm-sans)' }}
                            >
                              → {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[#2a2a2a] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {idea.createdAt}
                      </span>
                      <button
                        onClick={() => removeIdea(idea.id)}
                        className="text-[#2a2a2a] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
