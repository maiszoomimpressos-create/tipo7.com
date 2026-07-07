'use client'

import { useEffect, useState } from 'react'
import {
  Shield, Car, UtensilsCrossed, Beer, Accessibility, Wifi,
  Baby, HeartPulse, Cigarette, Camera, Tag, Loader2, Check,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { LucideIcon } from 'lucide-react'

const ACCENT = '#E8B84B'

// Mapeamento de string → componente Lucide (mesmo conjunto dos atributos cadastrados)
const ICON_MAP: Record<string, LucideIcon> = {
  Shield, Car, UtensilsCrossed, Beer, Accessibility, Wifi,
  Baby, HeartPulse, Cigarette, Camera, Tag,
}

interface Attribute {
  id:          string
  name:        string
  icon:        string
  order_index: number
}

interface Props {
  eventoId: string
}

export function PainelAtributos({ eventoId }: Props) {
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [active,     setActive]     = useState<Set<string>>(new Set())
  const [loading,    setLoading]    = useState(true)
  const [toggling,   setToggling]   = useState<string | null>(null)

  // Carrega lista global de atributos e quais estão ativos para este evento
  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('event_attributes').select('id, name, icon, order_index').eq('active', true).order('order_index'),
      supabase.from('event_attribute_values').select('attribute_id').eq('event_id', eventoId),
    ]).then(([{ data: attrs }, { data: vals }]) => {
      setAttributes(attrs ?? [])
      setActive(new Set((vals ?? []).map(v => v.attribute_id)))
      setLoading(false)
    })
  }, [eventoId])

  async function toggle(attributeId: string) {
    setToggling(attributeId)
    const supabase = createClient()
    const isActive = active.has(attributeId)

    if (isActive) {
      // Remove o atributo do evento
      await supabase
        .from('event_attribute_values')
        .delete()
        .eq('event_id', eventoId)
        .eq('attribute_id', attributeId)
      setActive(prev => { const next = new Set(prev); next.delete(attributeId); return next })
    } else {
      // Ativa o atributo para o evento
      await supabase
        .from('event_attribute_values')
        .insert({ event_id: eventoId, attribute_id: attributeId })
      setActive(prev => new Set([...prev, attributeId]))
    }
    setToggling(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-[#444]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        Selecione o que estará disponível no evento. Aparece na página pública.
      </p>
      <div className="flex flex-col gap-1.5">
        {attributes.map(attr => {
          const Icon    = ICON_MAP[attr.icon] ?? Tag
          const enabled = active.has(attr.id)
          const busy    = toggling === attr.id
          return (
            <button
              key={attr.id}
              type="button"
              onClick={() => { if (!busy) toggle(attr.id) }}
              disabled={busy}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border transition-all text-left"
              style={{
                background: enabled ? `${ACCENT}0d` : '#0d0d0d',
                border:     `1px solid ${enabled ? ACCENT + '40' : '#1e1e1e'}`,
              }}
            >
              {/* Ícone com fundo responsivo ao estado */}
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                style={{ background: enabled ? `${ACCENT}20` : '#141414' }}
              >
                {busy
                  ? <Loader2 size={13} className="animate-spin" style={{ color: enabled ? ACCENT : '#444' }} />
                  : <Icon size={13} style={{ color: enabled ? ACCENT : '#444' }} />
                }
              </div>

              {/* Nome do atributo */}
              <span
                className="flex-1 text-xs font-medium transition-colors"
                style={{ color: enabled ? '#ddd' : '#555', fontFamily: 'var(--font-dm-sans)' }}
              >
                {attr.name}
              </span>

              {/* Checkmark quando ativo e não carregando */}
              {enabled && !busy && (
                <Check size={12} style={{ color: ACCENT }} className="shrink-0" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
