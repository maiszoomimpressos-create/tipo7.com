'use client'

import { useState } from 'react'
import { Copy, Check, Users, MapPin, User, AlertCircle } from 'lucide-react'

interface Props {
  codigo:  string
  tipo:    'usuario' | 'promotora' | 'estabelecimento'
  nome:    string
}

const TIPO_CONFIG = {
  usuario: {
    label: 'Seu código pessoal',
    desc:  'Código único e permanente, ligado a você — não muda mesmo se você virar promotor ou dono de estabelecimento depois. Use pra participar de eventos ou ser convidado pra trabalhar numa equipe.',
    icon:  User,
  },
  promotora: {
    label: 'Promotor de eventos',
    desc:  'Código da sua organização como promotor. É diferente do seu código pessoal — identifica a promotora em si, não você.',
    icon:  Users,
  },
  estabelecimento: {
    label: 'Estabelecimento',
    desc:  'Código do seu estabelecimento. É diferente do seu código pessoal — identifica o local/negócio em si, não você.',
    icon:  MapPin,
  },
}

export function CodigoOrg({ codigo, tipo, nome }: Props) {
  const [copiado, setCopiado] = useState(false)
  const [mostrarAjuda, setMostrarAjuda] = useState(false)
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
            <div className="flex items-center gap-1.5 relative">
              <p className="text-[#444] text-[10px] uppercase tracking-widest mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {cfg.label}
              </p>
              <button
                type="button"
                onClick={() => setMostrarAjuda(v => !v)}
                onMouseEnter={() => setMostrarAjuda(true)}
                onMouseLeave={() => setMostrarAjuda(false)}
                className="text-[#555] hover:text-[#E8B84B] transition-colors mb-0.5"
              >
                <AlertCircle size={11} />
              </button>
              {mostrarAjuda && (
                <div
                  className="absolute left-0 top-full mt-1.5 z-20 w-60 p-2.5 rounded-lg text-[10px] leading-snug text-[#ccc] shadow-xl shadow-black/50"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', fontFamily: 'var(--font-dm-sans)' }}
                >
                  {cfg.desc}
                </div>
              )}
            </div>
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
