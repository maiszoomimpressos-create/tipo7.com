'use client'

import { useState } from 'react'
import { Copy, Check, Users, MapPin } from 'lucide-react'

interface Props {
  codigo:  string
  tipo:    'promotora' | 'estabelecimento'
  nome:    string
}

const TIPO_CONFIG = {
  promotora:      { label: 'Promotor de eventos', icon: Users,  prefix: 'T7-PRO' },
  estabelecimento:{ label: 'Estabelecimento',      icon: MapPin, prefix: 'T7-EST' },
}

export function CodigoOrg({ codigo, tipo, nome }: Props) {
  const [copiado, setCopiado] = useState(false)
  const cfg = TIPO_CONFIG[tipo]
  const Icon = cfg.icon

  const copiar = async () => {
    await navigator.clipboard.writeText(codigo)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div
      className="mb-6 rounded-2xl overflow-hidden"
      style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
    >
      {/* Faixa dourada topo */}
      <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #E8B84B, transparent)' }} />

      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Ícone */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(232,184,75,0.10)', border: '1px solid rgba(232,184,75,0.20)' }}
          >
            <Icon size={16} className="text-[#E8B84B]" />
          </div>

          <div className="min-w-0">
            <p className="text-[#444] text-[10px] uppercase tracking-widest mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {cfg.label}
            </p>
            <p
              className="text-[#E8B84B] text-lg font-bold tracking-widest"
              style={{ fontFamily: 'var(--font-syne)', letterSpacing: '0.08em' }}
            >
              {codigo}
            </p>
            <p className="text-[#444] text-xs truncate mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {nome}
            </p>
          </div>
        </div>

        {/* Botão copiar */}
        <button
          type="button"
          onClick={copiar}
          title="Copiar código"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-all shrink-0"
          style={{
            background:  copiado ? 'rgba(34,197,94,0.10)' : 'rgba(232,184,75,0.08)',
            border:      `1px solid ${copiado ? 'rgba(34,197,94,0.25)' : 'rgba(232,184,75,0.20)'}`,
            color:       copiado ? '#22c55e' : '#E8B84B',
            fontFamily:  'var(--font-dm-sans)',
          }}
        >
          {copiado
            ? <><Check size={12} /> Copiado</>
            : <><Copy size={12} /> Copiar</>
          }
        </button>
      </div>
    </div>
  )
}
