'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, AlertTriangle, CheckCircle2, Wallet, Car } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'

const ACCENT = '#E8B84B'

interface Pendencias {
  pode_encerrar:    boolean
  caixas_pendentes: { id: string; nome: string; status: string }[]
  sessoes_abertas:  { id: string; placa: string; estacionamento_nome: string }[]
}

// Encerramento de evento (20/08/2026, design combinado — ver
// project_token_pin_acesso_caixa na memória). Motivado por achado real:
// evento de teste com data vencida há 4 dias, ainda 100% ativo, porque
// nada fechava sozinho.
//
// Caminho normal: sem pendência, um clique fecha. Caminho de exceção: com
// caixa aberto ou sessão de estacionamento pendente, exige "assinatura" —
// o PIN do próprio dono (mesmo mecanismo da sangria) ou a senha da conta,
// não é só confirmar um alerta.
export function ModalEncerrarEvento({ eventoId, onFechar, onEncerrado }: {
  eventoId: string
  onFechar: () => void
  onEncerrado: () => void
}) {
  const [carregando, setCarregando] = useState(true)
  const [pendencias, setPendencias] = useState<Pendencias | null>(null)
  const [forcando, setForcando]     = useState(false)
  const [codigo, setCodigo]         = useState('')
  const [enviando, setEnviando]     = useState(false)
  const [erro, setErro]             = useState<string | null>(null)
  const [sucesso, setSucesso]       = useState(false)

  useEffect(() => {
    (async () => {
      const res = await apiFetchAuth(`/api/eventos/${eventoId}/encerramento/pendencias`)
      if (res.ok) setPendencias(await res.json())
      setCarregando(false)
    })()
  }, [eventoId])

  async function confirmar(forcar: boolean) {
    setErro(null)
    if (forcar && !codigo.trim()) { setErro('Informe seu PIN ou senha pra autorizar mesmo com pendência.'); return }
    setEnviando(true)
    try {
      const res = await apiFetchAuth(`/api/eventos/${eventoId}/encerrar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(forcar ? { forcar: true, codigo: codigo.trim() } : {}),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? data.message ?? 'Erro ao encerrar evento'); return }
      if (data.precisa_forcar) { setForcando(true); return }
      setSucesso(true)
      onEncerrado()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onFechar}>
      <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-white text-sm font-medium">Encerrar evento</p>
          <button onClick={onFechar} className="text-[#444] hover:text-[#777]"><X size={16} /></button>
        </div>

        {carregando ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-[#444]" /></div>
        ) : sucesso ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 size={28} className="text-green-400" />
            <p className="text-white text-sm">Evento encerrado.</p>
          </div>
        ) : pendencias?.pode_encerrar && !forcando ? (
          <>
            <p className="text-[#888] text-xs mb-4">
              Tudo certo — todos os caixas estão fechados e não há veículo pendente no estacionamento. Confirma o encerramento?
            </p>
            {erro && <p className="text-red-400 text-xs mb-3">{erro}</p>}
            <button
              type="button" onClick={() => confirmar(false)} disabled={enviando}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: ACCENT }}
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : 'Encerrar evento'}
            </button>
          </>
        ) : !forcando ? (
          <>
            <div className="flex items-center gap-2 mb-3 text-amber-400 text-xs">
              <AlertTriangle size={13} /> Ainda tem pendência neste evento
            </div>
            <div className="flex flex-col gap-2 mb-4">
              {pendencias?.caixas_pendentes.map(c => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
                  <Wallet size={12} className="text-amber-400 shrink-0" />
                  <span className="text-[#aaa]">Caixa &quot;{c.nome}&quot; — {c.status}</span>
                </div>
              ))}
              {pendencias?.sessoes_abertas.map(s => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
                  <Car size={12} className="text-amber-400 shrink-0" />
                  <span className="text-[#aaa]">{s.placa} ainda dentro de &quot;{s.estacionamento_nome}&quot;</span>
                </div>
              ))}
            </div>
            <p className="text-[#555] text-[11px] mb-3">
              O ideal é resolver isso antes (fechar os caixas, registrar as saídas). Se precisar encerrar mesmo assim, dá pra forçar — mas fica registrado que foi uma decisão sua, com pendência.
            </p>
            <button
              type="button" onClick={() => setForcando(true)}
              className="w-full py-2.5 rounded-xl text-xs font-medium border transition-colors hover:border-red-400/40 hover:text-red-400"
              style={{ borderColor: '#222', color: '#888' }}
            >
              Forçar encerramento mesmo assim
            </button>
          </>
        ) : (
          <>
            <p className="text-[#888] text-xs mb-3">
              Digite seu PIN (ou a senha da sua conta) pra autorizar o encerramento com pendência — fica registrado que foi você.
            </p>
            <input
              type="password" placeholder="PIN ou senha" value={codigo}
              onChange={e => setCodigo(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none mb-3"
              style={{ background: '#111', border: '1px solid #1e1e1e' }}
            />
            {erro && <p className="text-red-400 text-xs mb-3">{erro}</p>}
            <button
              type="button" onClick={() => confirmar(true)} disabled={enviando}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: '#dc2626' }}
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : 'Forçar encerramento'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
