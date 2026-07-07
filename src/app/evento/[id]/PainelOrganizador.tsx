'use client'

import { useState } from 'react'
import { Ticket, Users, Settings, ExternalLink, BarChart2, Layers } from 'lucide-react'
import { PainelIngressos, type IngressoEditavel } from './PainelIngressos'
import { PainelEquipe } from './PainelEquipe'
import { PainelAtributos } from './PainelAtributos'

const ACCENT = '#E8B84B'

type Tab = 'ingressos' | 'atributos' | 'equipe'

interface Props {
  eventoId:  string
  ingressos: IngressoEditavel[]
  capacity:  number | null
}

export function PainelOrganizador({ eventoId, ingressos, capacity }: Props) {
  const [tab,           setTab]           = useState<Tab>('ingressos')
  const [localIngressos, setLocalIngressos] = useState(ingressos)

  function handleUpdate(id: string, fields: Partial<IngressoEditavel>) {
    setLocalIngressos(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t))
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1a1a1a', background: '#0a0a0a' }}>

      {/* Cabeçalho do painel */}
      <div className="px-4 pt-4 pb-0 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings size={14} style={{ color: ACCENT }} />
            <span className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
              Painel do organizador
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/dashboard/${eventoId}`}
              className="flex items-center gap-1 text-[#555] text-xs hover:text-white transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              <BarChart2 size={11} /> Relatórios
            </a>
            <span className="text-[#222]">·</span>
            <a
              href={`/criar-evento/${eventoId}`}
              className="flex items-center gap-1 text-[#555] text-xs hover:text-white transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Editar <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Abas */}
        <div className="flex border-b border-[#1a1a1a]">
          {([
            { key: 'ingressos',  label: 'Ingressos', icon: Ticket },
            { key: 'atributos', label: 'Estrutura',  icon: Layers },
            { key: 'equipe',    label: 'Equipe',     icon: Users  },
          ] as { key: Tab; label: string; icon: typeof Ticket }[]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative"
              style={{
                color:      tab === key ? ACCENT : '#555',
                fontFamily: 'var(--font-dm-sans)',
              }}
            >
              <Icon size={12} />
              {label}
              {tab === key && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                  style={{ background: ACCENT }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo da aba */}
      <div className="p-4">
        {tab === 'ingressos' && (
          <PainelIngressos
            eventoId={eventoId}
            ingressos={localIngressos}
            capacity={capacity}
            onUpdate={handleUpdate}
          />
        )}
        {/* Aba de estrutura: atributos disponíveis no evento */}
        {tab === 'atributos' && (
          <PainelAtributos eventoId={eventoId} />
        )}
        {tab === 'equipe' && (
          <PainelEquipe eventoId={eventoId} />
        )}
      </div>
    </div>
  )
}
