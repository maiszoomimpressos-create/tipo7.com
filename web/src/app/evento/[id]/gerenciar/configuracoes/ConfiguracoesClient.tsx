'use client'

import { useState, useEffect, useCallback } from 'react'
import { CalendarClock, PowerOff } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'
import { ModalEncerrarEvento } from '../../ModalEncerrarEvento'
import { ModalAdiarEvento } from '../../ModalAdiarEvento'

const ACCENT = '#E8B84B'

export function ConfiguracoesClient({ eventoId }: { eventoId: string }) {
  const [modalEncerrar, setModalEncerrar] = useState(false)
  const [modalAdiar, setModalAdiar]       = useState(false)
  const [pausaAutomatica, setPausaAutomatica] = useState(true)
  const [carregando, setCarregando]       = useState(true)
  const [salvandoPausaAuto, setSalvandoPausaAuto] = useState(false)

  const carregar = useCallback(async () => {
    const res = await apiFetchAuth(`/api/eventos/${eventoId}/caixas`)
    if (res.ok) {
      const data = await res.json()
      setPausaAutomatica(data.pausa_venda_automatica ?? true)
    }
    setCarregando(false)
  }, [eventoId])

  useEffect(() => { carregar() }, [carregar])

  async function alternarPausaAutomatica() {
    const novoValor = !pausaAutomatica
    setSalvandoPausaAuto(true)
    setPausaAutomatica(novoValor)
    try {
      const res = await apiFetchAuth(`/api/eventos/${eventoId}/pausa-venda-automatica`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativa: novoValor }),
      })
      if (!res.ok) setPausaAutomatica(!novoValor)
    } finally {
      setSalvandoPausaAuto(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl flex flex-col gap-4">
      {modalEncerrar && (
        <ModalEncerrarEvento
          eventoId={eventoId}
          onFechar={() => setModalEncerrar(false)}
          onEncerrado={() => { setModalEncerrar(false); window.location.reload() }}
        />
      )}
      {modalAdiar && (
        <ModalAdiarEvento
          eventoId={eventoId}
          onFechar={() => setModalAdiar(false)}
          onAdiado={() => { setModalAdiar(false); window.location.reload() }}
        />
      )}

      <p className="text-white text-lg font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>Configurações</p>

      {!carregando && (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
          <div className="flex-1">
            <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Pausar venda online automaticamente
            </p>
            <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {pausaAutomatica ? 'Pausa sozinho 1h antes do evento começar' : 'Desligado — venda online continua até você pausar na mão'}
            </p>
          </div>
          <button type="button" onClick={alternarPausaAutomatica} disabled={salvandoPausaAuto}
            className="w-12 h-6 rounded-full transition-colors relative shrink-0 disabled:opacity-50"
            style={{ background: pausaAutomatica ? ACCENT : '#222' }}>
            <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                 style={{ left: pausaAutomatica ? '26px' : '4px' }} />
          </button>
        </div>
      )}

      <button
        type="button" onClick={() => setModalAdiar(true)}
        className="rounded-2xl p-4 flex items-center gap-3 text-left transition-colors hover:border-[#E8B84B]/40"
        style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
      >
        <CalendarClock size={16} style={{ color: ACCENT }} />
        <div className="flex-1">
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Adiar evento</p>
          <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>Troca a data, reabre se estava encerrado, avisa quem já comprou</p>
        </div>
      </button>

      <button
        type="button" onClick={() => setModalEncerrar(true)}
        className="rounded-2xl p-4 flex items-center gap-3 text-left transition-colors hover:border-red-400/40"
        style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
      >
        <PowerOff size={16} className="text-red-400" />
        <div className="flex-1">
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Encerrar evento</p>
          <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>Fecha o evento e apaga o acesso (token/PIN) de quem trabalhou nele</p>
        </div>
      </button>
    </div>
  )
}
