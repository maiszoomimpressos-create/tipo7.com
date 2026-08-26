'use client'

import { useState } from 'react'
import { Car, BarChart2 } from 'lucide-react'
import { GerenciadorEstacionamentos } from '@/app/estacionamento/[eventoId]/GerenciadorEstacionamentos'

const ACCENT = '#E8B84B'

// Pedido do usuário (25/08/2026): antes, "Configure locais, preços e
// caixas" era só um botão que levava pra fora (/estacionamento/[eventoId]),
// obrigando sair do /gerenciar pra mexer em qualquer coisa. Agora fica
// embutido aqui dentro, em abas — "Estacionamentos" reaproveita o MESMO
// componente que a rota externa usa (GerenciadorEstacionamentos, com
// `embutido` escondendo o header/Voltar duplicados); "Relatórios" é nova,
// específica desse módulo (diferente do dashboard geral do evento).
export function EstacionamentoTabs({ eventoId, eventoTitle }: { eventoId: string; eventoTitle: string }) {
  const [aba, setAba] = useState<'estacionamentos' | 'relatorios'>('estacionamentos')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1.5 border-b border-[#1a1a1a]">
        {([
          { id: 'estacionamentos' as const, label: 'Estacionamentos', icon: Car },
          { id: 'relatorios'      as const, label: 'Relatórios',      icon: BarChart2 },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px"
            style={{
              borderColor: aba === id ? ACCENT : 'transparent',
              color:       aba === id ? ACCENT : '#555',
              fontFamily:  'var(--font-dm-sans)',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {aba === 'estacionamentos' && (
        <GerenciadorEstacionamentos eventoId={eventoId} eventoTitle={eventoTitle} embutido />
      )}

      {aba === 'relatorios' && (
        <div className="flex flex-col items-center text-center gap-2 py-14">
          <BarChart2 size={26} className="text-[#333]" />
          <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Relatórios do estacionamento ainda não existem — em especificação.
          </p>
        </div>
      )}
    </div>
  )
}
