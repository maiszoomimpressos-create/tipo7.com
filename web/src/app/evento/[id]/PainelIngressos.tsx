'use client'

import { useState } from 'react'
import { Ticket, Pencil, Check, X, Loader2, AlertTriangle, TrendingUp } from 'lucide-react'

export type IngressoEditavel = {
  id:       string
  name:     string
  price:    number
  quantity: number
  sold:     number
}

interface Props {
  eventoId:  string
  ingressos: IngressoEditavel[]
  capacity:  number | null
  onUpdate:  (id: string, fields: Partial<IngressoEditavel>) => void
}

const ACCENT = '#E8B84B'

function formatPrice(v: number) {
  return v === 0 ? 'Gratuito' : `R$ ${v.toFixed(2).replace('.', ',')}`
}

// ---------------------------------------------------------------------------
// Card de ingresso editável
// ---------------------------------------------------------------------------

function IngressoCard({
  ingresso,
  capacidadeDisponivel,
  onSave,
}: {
  ingresso:             IngressoEditavel
  capacidadeDisponivel: number | null
  onSave:               (fields: { name?: string; price?: number; quantity?: number }) => Promise<void>
}) {
  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState<string | null>(null)
  const [name,     setName]     = useState(ingresso.name)
  const [price,    setPrice]    = useState(String(ingresso.price))
  const [quantity, setQuantity] = useState(String(ingresso.quantity))

  const disponivel  = ingresso.quantity - ingresso.sold
  const pctVendido  = ingresso.quantity > 0 ? Math.round((ingresso.sold / ingresso.quantity) * 100) : 0
  const maxQuantity = capacidadeDisponivel !== null
    ? ingresso.quantity + capacidadeDisponivel   // pode aumentar até a sobra da capacidade
    : undefined

  function cancelar() {
    setEditing(false)
    setErr(null)
    setName(ingresso.name)
    setPrice(String(ingresso.price))
    setQuantity(String(ingresso.quantity))
  }

  async function salvar() {
    const newQty   = parseInt(quantity, 10)
    const newPrice = parseFloat(price.replace(',', '.'))

    if (isNaN(newQty)   || newQty   < 0) { setErr('Quantidade inválida');  return }
    if (isNaN(newPrice) || newPrice < 0) { setErr('Preço inválido');        return }
    if (!name.trim())                    { setErr('Nome obrigatório');       return }
    if (newQty < ingresso.sold)          {
      setErr(`Mínimo é ${ingresso.sold} (já vendidos)`)
      return
    }

    setSaving(true)
    setErr(null)
    try {
      await onSave({
        name:     name.trim(),
        price:    newPrice,
        quantity: newQty,
      })
      setEditing(false)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: editing ? `1px solid ${ACCENT}40` : '1px solid #1a1a1a', background: '#0d0d0d' }}
    >
      {/* Cabeçalho */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-[#E8B84B]/40"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
              placeholder="Nome do ingresso"
            />
          ) : (
            <p className="text-white text-sm font-semibold truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {ingresso.name}
            </p>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#1a1a1a] transition-colors shrink-0"
          >
            <Pencil size={13} className="text-[#444] hover:text-white" />
          </button>
        )}
      </div>

      {/* Barra de progresso de vendas */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[#555] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {ingresso.sold} vendidos · {disponivel} disponíveis
          </span>
          <span className="text-[#555] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {pctVendido}%
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width:      `${pctVendido}%`,
              background: pctVendido >= 90 ? '#f87171' : pctVendido >= 60 ? ACCENT : '#4ade80',
            }}
          />
        </div>
      </div>

      {/* Preço e quantidade (edição inline) */}
      <div className="px-4 pb-4 flex gap-3 items-end">
        <div className="flex-1">
          <p className="text-[#444] text-[10px] mb-1 uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Preço
          </p>
          {editing ? (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555] text-sm">R$</span>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                min="0"
                step="0.01"
                className="w-full bg-[#111] border border-[#222] rounded-lg pl-8 pr-3 py-2 text-white text-sm outline-none focus:border-[#E8B84B]/40"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
            </div>
          ) : (
            <p className="text-sm font-semibold" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
              {formatPrice(ingresso.price)}
            </p>
          )}
          {editing && ingresso.sold > 0 && (
            <p className="text-[#555] text-[10px] mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Aplica só às vendas futuras
            </p>
          )}
        </div>

        <div className="flex-1">
          <p className="text-[#444] text-[10px] mb-1 uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Total
          </p>
          {editing ? (
            <div>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                min={ingresso.sold}
                max={maxQuantity}
                className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#E8B84B]/40"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
              <p className="text-[#444] text-[10px] mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Mín. {ingresso.sold}
                {maxQuantity !== undefined && ` · Máx. ${maxQuantity}`}
              </p>
            </div>
          ) : (
            <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {ingresso.quantity} ingressos
            </p>
          )}
        </div>
      </div>

      {/* Botões de edição */}
      {editing && (
        <div className="px-4 pb-4 flex flex-col gap-2">
          {err && (
            <div className="flex items-center gap-2 text-red-400 text-xs py-2 px-3 rounded-lg bg-red-400/5">
              <AlertTriangle size={12} className="shrink-0" />
              {err}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancelar}
              className="flex-1 py-2 rounded-xl text-xs text-[#444] border border-[#1e1e1e] hover:text-white hover:border-[#333] transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-[#070707] disabled:opacity-60"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Painel principal
// ---------------------------------------------------------------------------

export function PainelIngressos({ eventoId, ingressos, capacity, onUpdate }: Props) {
  const [localIngressos, setLocalIngressos] = useState(ingressos)

  const totalEmUso = localIngressos.reduce((sum, t) => sum + t.quantity, 0)
  const totalVendido = localIngressos.reduce((sum, t) => sum + t.sold, 0)
  const capacidadePct = capacity ? Math.round((totalEmUso / capacity) * 100) : null

  async function handleSave(ticketId: string, fields: { name?: string; price?: number; quantity?: number }) {
    const res = await fetch(`/api/ingressos/${ticketId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error ?? 'Erro ao salvar')
    }
    setLocalIngressos(prev =>
      prev.map(t => t.id === ticketId ? { ...t, ...fields } : t)
    )
    onUpdate(ticketId, fields)
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Resumo de capacidade */}
      {capacity && (
        <div className="rounded-2xl p-4" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} style={{ color: ACCENT }} />
            <span className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-outfit)' }}>
              Capacidade do evento
            </span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {totalEmUso} alocados · {capacity - totalEmUso} disponíveis
            </span>
            <span className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {totalVendido} vendidos
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#1a1a1a] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width:      `${capacidadePct}%`,
                background: ACCENT,
              }}
            />
          </div>
          <p className="text-[#444] text-[10px] mt-1.5 text-right" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {totalEmUso} / {capacity} slots alocados
          </p>
        </div>
      )}

      {/* Lista de tipos de ingresso */}
      {localIngressos.length === 0 ? (
        <div className="text-center py-8">
          <Ticket size={24} className="text-[#333] mx-auto mb-2" />
          <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Nenhum tipo de ingresso cadastrado.
          </p>
          <a
            href={`/criar-evento/${eventoId}/ingressos`}
            className="inline-flex items-center gap-1.5 mt-3 text-xs text-[#E8B84B] hover:underline"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Gerenciar ingressos →
          </a>
        </div>
      ) : (
        localIngressos.map(ingresso => {
          // Capacidade disponível para este ingresso = sobra da capacidade total
          const somaOutros = localIngressos
            .filter(t => t.id !== ingresso.id)
            .reduce((sum, t) => sum + t.quantity, 0)
          const capacidadeDisponivel = capacity !== null ? capacity - somaOutros - ingresso.quantity : null

          return (
            <IngressoCard
              key={ingresso.id}
              ingresso={ingresso}
              capacidadeDisponivel={capacidadeDisponivel}
              onSave={fields => handleSave(ingresso.id, fields)}
            />
          )
        })
      )}
    </div>
  )
}
