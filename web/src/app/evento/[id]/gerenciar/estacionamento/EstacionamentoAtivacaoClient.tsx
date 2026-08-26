'use client'

import { useState } from 'react'
import { Car, Loader2 } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'
import { EstacionamentoTabs } from './EstacionamentoTabs'

const ACCENT = '#E8B84B'

interface Props {
  eventoId:    string
  eventoTitle: string
  ativoInicial: boolean
}

// Mesma lógica de handleAtivarEstacionamento() que vivia em
// PainelOrganizador.tsx — só movida pra cá.
export function EstacionamentoAtivacaoClient({ eventoId, eventoTitle, ativoInicial }: Props) {
  const [ativo, setAtivo]     = useState(ativoInicial)
  const [ativando, setAtivando] = useState(false)
  const [erro, setErro]       = useState<string | null>(null)

  async function ativar() {
    setAtivando(true); setErro(null)
    try {
      const res = await apiFetchAuth(`/api/eventos/${eventoId}/modulos`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ moduloEstacionamento: true }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao ativar'); return }
      setAtivo(true)
    } finally {
      setAtivando(false)
    }
  }

  if (!ativo) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-10">
        <Car size={28} className="text-[#444]" />
        <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Estacionamento ainda não está ativado neste evento
        </p>
        <p className="text-[#555] text-xs max-w-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Pode ativar a qualquer momento, mesmo com o evento já publicado — não afeta o que já está configurado.
        </p>
        {erro && <p className="text-red-400 text-xs">{erro}</p>}
        <button type="button" onClick={ativar} disabled={ativando}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-50"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
        >
          {ativando ? <Loader2 size={15} className="animate-spin" /> : 'Ativar estacionamento'}
        </button>
      </div>
    )
  }

  return <EstacionamentoTabs eventoId={eventoId} eventoTitle={eventoTitle} />
}
