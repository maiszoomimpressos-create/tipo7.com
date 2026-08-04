'use client'

import { useState, useEffect } from 'react'
import { PiggyBank, ChevronDown, AlertTriangle, Loader2 } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'

const ACCENT = '#E8B84B'

interface Saldo {
  event_id:        string
  event_title:     string
  bloqueio_ativo:  boolean
  meta_reserva:    number
  saldo_atual:     number
  aviso_disparado: boolean
}

interface Movimento {
  id:               string
  tipo:             string
  valor:            number
  saldo_resultante: number
  criado_em:        string
}

const TIPO_LABEL: Record<string, string> = {
  incremento_venda_online: 'Venda on-line',
  debito_venda_bilheteria: 'Venda bilheteria',
  recalculo_meta:          'Recálculo de meta',
  ajuste_manual:           'Ajuste manual',
}

function formatBRL(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

export function SaldoBilheteriaAdmin() {
  const [saldos, setSaldos]     = useState<Saldo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [expandido, setExpandido]   = useState<string | null>(null)
  const [movimentos, setMovimentos] = useState<Movimento[]>([])
  const [carregandoMov, setCarregandoMov] = useState(false)

  useEffect(() => {
    apiFetchAuth('/api/admin/saldo-bilheteria')
      .then(r => r.json())
      .then(d => setSaldos(d.saldos ?? []))
      .finally(() => setCarregando(false))
  }, [])

  async function toggleBloqueio(eventId: string, atual: boolean) {
    setSaldos(prev => prev.map(s => s.event_id === eventId ? { ...s, bloqueio_ativo: !atual } : s))
    await apiFetchAuth('/api/admin/saldo-bilheteria', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, bloqueio_ativo: !atual }),
    })
  }

  async function toggleExpandir(eventId: string) {
    if (expandido === eventId) { setExpandido(null); return }
    setExpandido(eventId)
    setCarregandoMov(true)
    const res  = await apiFetchAuth(`/api/admin/saldo-bilheteria/movimentos?event_id=${eventId}`)
    const data = await res.json()
    setMovimentos(data.movimentos ?? [])
    setCarregandoMov(false)
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-[#444]" />
      </div>
    )
  }

  if (saldos.length === 0) {
    return (
      <div className="rounded-2xl p-6 text-sm text-[#666]" style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', fontFamily: 'var(--font-dm-sans)' }}>
        Nenhum evento com saldo de bilheteria ativo no momento.
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a' }}>
        <PiggyBank size={13} style={{ color: ACCENT }} />
        <p className="text-white text-xs font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Saldo de bilheteria por evento
        </p>
      </div>
      <div style={{ background: '#070707' }}>
        {saldos.map((s, i) => (
          <div key={s.event_id} style={{ borderBottom: i < saldos.length - 1 ? '1px solid #111' : 'none' }}>
            <div className="flex items-center justify-between px-5 py-3 gap-3">
              <button type="button" onClick={() => toggleExpandir(s.event_id)} className="min-w-0 flex-1 text-left flex items-center gap-2">
                <ChevronDown size={12} className="text-[#444] shrink-0 transition-transform" style={{ transform: expandido === s.event_id ? 'rotate(180deg)' : 'none' }} />
                <div className="min-w-0">
                  <p className="text-white text-xs font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>{s.event_title}</p>
                  <p className="text-[#555] text-[10px] mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {formatBRL(s.saldo_atual)} de {formatBRL(s.meta_reserva)} previstos
                  </p>
                </div>
              </button>

              {s.aviso_disparado && (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                      style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430', fontFamily: 'var(--font-dm-sans)' }}>
                  <AlertTriangle size={10} /> Saldo baixo
                </span>
              )}

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-[#555]" style={{ fontFamily: 'var(--font-dm-sans)' }}>Bloqueio</span>
                <button type="button" onClick={() => toggleBloqueio(s.event_id, s.bloqueio_ativo)}
                  className="w-10 h-5 rounded-full transition-colors relative shrink-0"
                  style={{ background: s.bloqueio_ativo ? ACCENT : '#222' }}>
                  <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                       style={{ left: s.bloqueio_ativo ? '22px' : '2px' }} />
                </button>
              </div>
            </div>

            {expandido === s.event_id && (
              <div className="px-5 pb-4">
                {carregandoMov ? (
                  <Loader2 size={14} className="animate-spin text-[#444]" />
                ) : movimentos.length === 0 ? (
                  <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>Nenhum movimento ainda.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {movimentos.map(m => (
                      <div key={m.id} className="flex items-center justify-between text-[11px] px-3 py-2 rounded-lg" style={{ background: '#0d0d0d' }}>
                        <div className="flex flex-col">
                          <span className="text-[#999]" style={{ fontFamily: 'var(--font-dm-sans)' }}>{TIPO_LABEL[m.tipo] ?? m.tipo}</span>
                          <span className="text-[#444] text-[10px]">{new Date(m.criado_em).toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="text-right">
                          <p style={{ color: m.valor >= 0 ? '#4ade80' : '#f87171', fontFamily: 'var(--font-dm-sans)' }}>
                            {m.valor >= 0 ? '+' : ''}{formatBRL(m.valor)}
                          </p>
                          <p className="text-[#555] text-[10px]">saldo: {formatBRL(m.saldo_resultante)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
