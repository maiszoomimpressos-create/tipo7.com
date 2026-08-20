'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, CheckCircle2, CalendarClock } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'

const ACCENT = '#E8B84B'

// Converte um ISO (UTC, vindo do banco) pro formato que <input type="datetime-local">
// espera (sem timezone, hora local do navegador) — mesma pegadinha de fuso já
// documentada em outros lugares do projeto (ex: estacionamento.service.ts).
function isoParaDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Adiar evento (20/08/2026, pedido do usuário) — só a mecânica: troca a
// data, reabre o evento se tinha sido encerrado, reativa venda online.
// Avisar quem já comprou ingresso fica pra depois (escopo maior, não existe
// notificação em massa hoje).
export function ModalAdiarEvento({ eventoId, onFechar, onAdiado }: {
  eventoId: string
  onFechar: () => void
  onAdiado: () => void
}) {
  const [carregando, setCarregando] = useState(true)
  const [dateStart, setDateStart]   = useState('')
  const [dateEnd, setDateEnd]       = useState('')
  const [enviando, setEnviando]     = useState(false)
  const [erro, setErro]             = useState<string | null>(null)
  const [sucesso, setSucesso]       = useState<{ reaberto: boolean } | null>(null)

  useEffect(() => {
    (async () => {
      const res = await apiFetchAuth(`/api/eventos/${eventoId}/meu-acesso`)
      if (res.ok) {
        const data = await res.json() as { evento: { dateStart: string | null; dateEnd: string | null } | null }
        setDateStart(isoParaDatetimeLocal(data.evento?.dateStart ?? null))
        setDateEnd(isoParaDatetimeLocal(data.evento?.dateEnd ?? null))
      }
      setCarregando(false)
    })()
  }, [eventoId])

  async function confirmar() {
    setErro(null)
    if (!dateStart) { setErro('Informe a nova data de início'); return }
    setEnviando(true)
    try {
      const res = await apiFetchAuth(`/api/eventos/${eventoId}/adiar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          dateStart: new Date(dateStart).toISOString(),
          dateEnd:   dateEnd ? new Date(dateEnd).toISOString() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? data.message ?? 'Erro ao adiar evento'); return }
      setSucesso({ reaberto: !!data.reaberto })
      onAdiado()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onFechar}>
      <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-white text-sm font-medium flex items-center gap-1.5">
            <CalendarClock size={14} style={{ color: ACCENT }} /> Adiar evento
          </p>
          <button onClick={onFechar} className="text-[#444] hover:text-[#777]"><X size={16} /></button>
        </div>

        {carregando ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-[#444]" /></div>
        ) : sucesso ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 size={28} className="text-green-400" />
            <p className="text-white text-sm">Evento adiado para a nova data.</p>
            {sucesso.reaberto && (
              <p className="text-[#666] text-xs">O evento estava encerrado — reaberto automaticamente.</p>
            )}
          </div>
        ) : (
          <>
            <p className="text-[#666] text-xs mb-4">
              Troca a data do evento. Se ele já tinha sido encerrado (pela data antiga), volta a ficar publicado, e a venda online é reativada.
            </p>
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="text-[#555] text-[10px] uppercase tracking-wider block mb-1">Novo início</label>
                <input
                  type="datetime-local" value={dateStart}
                  onChange={e => setDateStart(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: '#111', border: '1px solid #1e1e1e' }}
                />
              </div>
              <div>
                <label className="text-[#555] text-[10px] uppercase tracking-wider block mb-1">Novo fim (opcional)</label>
                <input
                  type="datetime-local" value={dateEnd}
                  onChange={e => setDateEnd(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: '#111', border: '1px solid #1e1e1e' }}
                />
              </div>
            </div>
            {erro && <p className="text-red-400 text-xs mb-3">{erro}</p>}
            <button
              type="button" onClick={confirmar} disabled={enviando}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: ACCENT }}
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar novo horário'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
