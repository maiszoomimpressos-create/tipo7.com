'use client'

import { useState } from 'react'
import { PainelIngressos, type IngressoEditavel } from '../../PainelIngressos'

interface Props {
  eventoId:         string
  ingressos:        IngressoEditavel[]
  capacity:         number | null
  dias:             { id: string; dayNumber: number; date: string; startTime?: string; endTime?: string }[]
  diaSelecionadoId: string | null
}

// Casca client-side só pra guardar o estado local de edição otimista —
// mesmo papel que useState(ingressos) fazia dentro de PainelOrganizador.tsx.
export function PainelIngressosClient({ eventoId, ingressos, capacity, dias, diaSelecionadoId }: Props) {
  const [localIngressos, setLocalIngressos] = useState(ingressos)

  function handleUpdate(id: string, fields: Partial<IngressoEditavel>) {
    setLocalIngressos(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t))
  }

  return (
    <div className="p-6 max-w-3xl">
      <PainelIngressos
        eventoId={eventoId}
        ingressos={localIngressos}
        capacity={capacity}
        dias={dias}
        diaSelecionadoId={diaSelecionadoId}
        onUpdate={handleUpdate}
      />
    </div>
  )
}
