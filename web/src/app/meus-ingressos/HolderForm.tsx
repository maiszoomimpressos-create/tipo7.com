'use client'

// Formulário inline para cadastro de portadores de ingresso por slot
import { useState } from 'react'
import { User, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

type Holder = {
  full_name:  string
  cpf:        string
  email:      string
  birth_date: string
}

type Slot = {
  slot_number: number
  holder:      Holder | null
}

interface Props {
  orderItemId: string
  ticketName:  string
  quantity:    number
  slots:       Slot[]
  onSaved:     () => void
}

function formatCPF(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

function formatBirthDate(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

function isoToDisplay(iso: string) {
  if (!iso || iso.length < 10) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function displayToISO(display: string) {
  const parts = display.split('/')
  if (parts.length !== 3 || parts[2].length < 4) return ''
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
}

function SlotCard({
  orderItemId,
  slot,
  ticketName,
  onSaved,
}: {
  orderItemId: string
  slot: Slot
  ticketName: string
  onSaved: () => void
}) {
  const already = slot.holder !== null
  const [open, setOpen]   = useState(!already)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(already)
  const [err, setErr]       = useState<string | null>(null)

  const [form, setForm] = useState<Holder>(
    slot.holder
      ? { ...slot.holder, birth_date: isoToDisplay(slot.holder.birth_date) }
      : { full_name: '', cpf: '', email: '', birth_date: '' }
  )

  function set(field: keyof Holder, value: string) {
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
      const res = await fetch('/api/holders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: orderItemId,
          slot_number:   slot.slot_number,
          full_name:     form.full_name,
          cpf:           form.cpf.replace(/\D/g, ''),
          email:         form.email,
          birth_date:    displayToISO(form.birth_date),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Erro ao salvar')
      }
      setSaved(true)
      setOpen(false)
      onSaved()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-[#1e1e1e] rounded-xl overflow-hidden">
      {/* Header do slot */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#111] hover:bg-[#141414] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
            saved ? 'bg-green-500/20 border border-green-500/30' : 'bg-[#1a1a1a] border border-[#222]'
          }`}>
            {saved
              ? <Check size={12} className="text-green-400" />
              : <User size={12} className="text-[#444]" />
            }
          </div>
          <div className="text-left">
            <span className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {ticketName} — Portador {slot.slot_number}
            </span>
            {saved && (
              <p className="text-[#555] text-xs mt-0.5">
                {slot.holder?.full_name ?? form.full_name}
              </p>
            )}
          </div>
        </div>
        {open ? <ChevronUp size={14} className="text-[#444]" /> : <ChevronDown size={14} className="text-[#444]" />}
      </button>

      {/* Formulário */}
      {open && (
        <div className="px-4 py-4 bg-[#0d0d0d] space-y-3">
          <div className="grid grid-cols-1 gap-3">

            <div>
              <label className="block text-[#444] text-xs mb-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Nome completo *
              </label>
              <input
                type="text"
                value={form.full_name}
                onChange={e => set('full_name', e.target.value)}
                placeholder="João da Silva"
                className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#333] focus:outline-none focus:border-[#E8B84B]/40 transition-colors"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#444] text-xs mb-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  CPF *
                </label>
                <input
                  type="text"
                  value={form.cpf}
                  onChange={e => set('cpf', e.target.value)}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#333] focus:outline-none focus:border-[#E8B84B]/40 transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
              </div>
              <div>
                <label className="block text-[#444] text-xs mb-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Data de nascimento *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.birth_date}
                  onChange={e => set('birth_date', e.target.value)}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#333] focus:outline-none focus:border-[#E8B84B]/40 transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-[#444] text-xs mb-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                E-mail *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#333] focus:outline-none focus:border-[#E8B84B]/40 transition-colors"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
            </div>

          </div>

          {err && (
            <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{err}</p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-[#070707] disabled:opacity-60 transition-opacity"
            style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Salvando...' : 'Confirmar portador'}
          </button>
        </div>
      )}
    </div>
  )
}

export function HolderForm({ orderItemId, ticketName, quantity, slots, onSaved }: Props) {
  const filled    = slots.filter(s => s.holder !== null).length
  const allFilled = filled === quantity

  return (
    <div className="space-y-2">
      {/* Progresso */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Portadores preenchidos
        </span>
        <span className={`text-xs font-medium ${allFilled ? 'text-green-400' : 'text-[#E8B84B]'}`}
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {filled}/{quantity}
        </span>
      </div>

      {slots.map(slot => (
        <SlotCard
          key={slot.slot_number}
          orderItemId={orderItemId}
          slot={slot}
          ticketName={ticketName}
          onSaved={onSaved}
        />
      ))}
    </div>
  )
}
