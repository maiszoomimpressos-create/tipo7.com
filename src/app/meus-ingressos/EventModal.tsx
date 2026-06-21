'use client'

// Modal de detalhes do evento + gestão de portadores (edição inline por slot)
import { useEffect, useRef, useState } from 'react'
import { X, CalendarDays, MapPin, Ticket, Pencil, Check, Loader2, Users } from 'lucide-react'
import type { EventGroup } from './MeusIngressosClient'

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function formatDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatCPF(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

// Máscara DD/MM/AAAA para digitação livre no campo de data
function formatBirthDate(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

// Converte ISO (YYYY-MM-DD) → DD/MM/AAAA para exibir no input
function isoToDisplay(iso: string) {
  if (!iso || iso.length < 10) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Converte DD/MM/AAAA → ISO (YYYY-MM-DD) para salvar
function displayToISO(display: string) {
  const parts = display.split('/')
  if (parts.length !== 3 || parts[2].length < 4) return ''
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Linha de portador — exibe nome ou formulário de edição
// ---------------------------------------------------------------------------

type SlotData = {
  slot_number: number
  full_name:   string
  cpf:         string
  email:       string
  birth_date:  string
}

function SlotRow({
  orderItemId,
  ticketName,
  slotNumber,
  initial,
  onSaved,
}: {
  orderItemId: string
  ticketName:  string
  slotNumber:  number
  initial:     SlotData | null
  onSaved:     (data: SlotData) => void
}) {
  const [editing, setEditing] = useState(!initial)
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState<string | null>(null)
  const [form, setForm] = useState<SlotData>(
    initial
      ? { ...initial, birth_date: isoToDisplay(initial.birth_date) }
      : { slot_number: slotNumber, full_name: '', cpf: '', email: '', birth_date: '' }
  )

  function set(field: keyof SlotData, value: string) {
    let v = value
    if (field === 'cpf')        v = formatCPF(value)
    if (field === 'birth_date') v = formatBirthDate(value)
    setForm(f => ({ ...f, [field]: v }))
  }

  async function handleSave() {
    if (!form.full_name || !form.cpf || !form.email || !form.birth_date) {
      setErr('Preencha todos os campos')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const isoDate = displayToISO(form.birth_date)
      if (!isoDate) {
        setErr('Data de nascimento inválida')
        setSaving(false)
        return
      }
      const res = await fetch('/api/holders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: orderItemId,
          slot_number:   slotNumber,
          full_name:     form.full_name,
          cpf:           form.cpf.replace(/\D/g, ''),
          email:         form.email,
          birth_date:    isoDate,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Erro ao salvar')
      }
      setEditing(false)
      onSaved({ ...form, slot_number: slotNumber })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  // Linha de exibição (não editando)
  if (!editing) {
    return (
      <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
        <div>
          <p className="text-[#555] text-[10px] mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {ticketName} · Portador {slotNumber}
          </p>
          <p className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {form.full_name}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[#1a1a1a]"
        >
          <Pencil size={13} className="text-[#444] hover:text-white" />
        </button>
      </div>
    )
  }

  // Formulário de edição inline
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(232,184,75,0.2)', background: '#0d0d0d' }}>
      <div className="px-3 py-2 border-b border-[#1a1a1a]">
        <p className="text-[#E8B84B] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {ticketName} · Portador {slotNumber}
        </p>
      </div>
      <div className="px-3 py-3 space-y-2.5">
        <input
          type="text"
          value={form.full_name}
          onChange={e => set('full_name', e.target.value)}
          placeholder="Nome completo"
          className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2 text-white text-sm placeholder-[#333] focus:outline-none focus:border-[#E8B84B]/40 transition-colors"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={form.cpf}
            onChange={e => set('cpf', e.target.value)}
            placeholder="CPF"
            maxLength={14}
            className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2 text-white text-sm placeholder-[#333] focus:outline-none focus:border-[#E8B84B]/40 transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          />
          <input
            type="text"
            inputMode="numeric"
            value={form.birth_date}
            onChange={e => set('birth_date', e.target.value)}
            placeholder="DD/MM/AAAA"
            maxLength={10}
            className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2 text-white text-sm placeholder-[#333] focus:outline-none focus:border-[#E8B84B]/40 transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          />
        </div>
        <input
          type="email"
          value={form.email}
          onChange={e => set('email', e.target.value)}
          placeholder="E-mail"
          className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2 text-white text-sm placeholder-[#333] focus:outline-none focus:border-[#E8B84B]/40 transition-colors"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        />

        {err && <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{err}</p>}

        <div className="flex gap-2 pt-0.5">
          {initial && (
            <button
              type="button"
              onClick={() => { setEditing(false); setForm(initial) }}
              className="flex-1 py-2 rounded-lg text-xs text-[#444] border border-[#1e1e1e] hover:border-[#333] hover:text-white transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-[#070707] disabled:opacity-60"
            style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {saving ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal principal
// ---------------------------------------------------------------------------

interface Props {
  group:   EventGroup
  onClose: () => void
  onSaved: () => void
}

export function EventModal({ group, onClose, onSaved }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Estado local dos portadores (para atualizar sem fechar o modal)
  type LocalHolder = { [key: string]: SlotData } // key = `${itemId}-${slot}`
  const [localHolders, setLocalHolders] = useState<LocalHolder>(() => {
    const h: LocalHolder = {}
    for (const { item } of group.items) {
      for (const holder of item.ticket_holders ?? []) {
        h[`${item.id}-${holder.slot_number}`] = holder
      }
    }
    return h
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const ev = group.event

  // Conta portadores preenchidos com o estado local
  const totalSlots  = group.totalTickets
  const filledSlots = Object.keys(localHolders).length

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl"
        style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
      >
        {/* Banner + overlay */}
        <div className="relative" style={{ aspectRatio: '780/300' }}>
          {ev?.banner_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ev.banner_url} alt={ev.title ?? ''} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#111]" />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(7,7,7,0.95) 100%)' }} />

          {/* Fechar */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <X size={15} className="text-white" />
          </button>

          {/* Info sobre o gradiente */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
            <h2 className="text-white text-xl leading-snug mb-1.5" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>
              {ev?.title ?? 'Evento'}
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {ev?.date_start && (
                <span className="flex items-center gap-1.5 text-[#888] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  <CalendarDays size={11} /> {formatDate(ev.date_start)}
                </span>
              )}
              {(ev?.venue_name || ev?.city) && (
                <span className="flex items-center gap-1.5 text-[#888] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  <MapPin size={11} /> {[ev.venue_name, ev.city, ev.state].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Corpo */}
        <div className="px-5 py-5 space-y-5">

          {/* Resumo de ingressos + total */}
          <div className="flex items-center justify-between pb-4 border-b border-[#131313]">
            <div className="flex items-center gap-2">
              <Ticket size={14} className="text-[#E8B84B]" />
              <span className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {group.totalTickets} {group.totalTickets === 1 ? 'ingresso' : 'ingressos'}
              </span>
              {group.items.map(({ item }) => (
                <span key={item.id} className="text-[#333] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {item.event_tickets?.name ?? 'Ingresso'} ×{item.quantity}
                </span>
              ))}
            </div>
            <span className="text-[#E8B84B] font-semibold text-sm" style={{ fontFamily: 'var(--font-syne)' }}>
              {formatMoney(group.totalPaid)}
            </span>
          </div>

          {/* Portadores */}
          {group.allApproved && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-[#E8B84B]" />
                  <span className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-outfit)' }}>
                    Portadores
                  </span>
                </div>
                <span
                  className={`text-xs ${filledSlots >= totalSlots ? 'text-green-400' : 'text-[#555]'}`}
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                >
                  {filledSlots}/{totalSlots} preenchidos
                </span>
              </div>

              <div className="space-y-2">
                {group.items.map(({ item }) =>
                  Array.from({ length: item.quantity }, (_, i) => {
                    const key     = `${item.id}-${i + 1}`
                    const initial = localHolders[key] ?? null
                    return (
                      <SlotRow
                        key={key}
                        orderItemId={item.id}
                        ticketName={item.event_tickets?.name ?? 'Ingresso'}
                        slotNumber={i + 1}
                        initial={initial}
                        onSaved={(data) => {
                          setLocalHolders(prev => ({ ...prev, [key]: data }))
                          onSaved()
                        }}
                      />
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Link evento */}
          {ev?.id && (
            <a
              href={`/evento/${ev.id}`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm text-[#444] hover:text-white transition-colors border border-[#1a1a1a] hover:border-[#333]"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Ver página do evento
            </a>
          )}

        </div>
      </div>
    </div>
  )
}
