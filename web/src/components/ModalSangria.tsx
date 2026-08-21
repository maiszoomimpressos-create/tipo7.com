'use client'

import { useState } from 'react'
import { MinusCircle, Loader2, X, CheckCircle2 } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'

const ACCENT = '#E8B84B'

// Sangria (20/08/2026, design combinado — ver project_token_pin_acesso_caixa
// na memória): retirada parcial de dinheiro da gaveta sem fechar o caixa.
// Quem opera a tela pode não ser quem pega o dinheiro de fato — por isso o
// formulário pede um "código de quem retira" (PIN de staff autorizado
// naquele evento, ou senha do dono), separado de estar logado aqui.
// Compartilhado entre a Bilheteria (CaixaSidebar) e o Estacionamento
// (AtendenteClient) — mesmo endpoint, mesmo comportamento nos dois.
export function ModalSangria({ caixaId, onFechar, onSangrada }: { caixaId: string; onFechar: () => void; onSangrada: () => void }) {
  const [valor,    setValor]    = useState('')
  const [motivo,   setMotivo]   = useState('')
  const [codigo,   setCodigo]   = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro,     setErro]     = useState<string | null>(null)
  const [sucesso,  setSucesso]  = useState<{ retirado_por: string } | null>(null)

  async function confirmar() {
    setErro(null)
    const valorNum = Number(valor.replace(',', '.'))
    if (!valorNum || valorNum <= 0) { setErro('Informe um valor válido'); return }
    if (!codigo.trim()) { setErro('Informe o código de quem está retirando o dinheiro'); return }

    setEnviando(true)
    try {
      const res  = await apiFetchAuth('/api/caixas/sangria', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ caixaId, valor: valorNum, motivo: motivo.trim() || undefined, codigo: codigo.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.message ?? data.error ?? 'Erro ao registrar sangria'); return }
      setSucesso({ retirado_por: data.retirado_por })
      onSangrada()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5"
        style={{ background: '#0d0d0d', border: '1px solid #1e1e1e' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-white text-sm font-medium flex items-center gap-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <MinusCircle size={14} className="text-red-400" /> Sangria de caixa
          </p>
          <button onClick={onFechar} className="text-[#444] hover:text-[#777]"><X size={16} /></button>
        </div>

        {sucesso ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 size={28} className="text-green-400" />
            <p className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Retirado por <span className="font-semibold">{sucesso.retirado_por}</span>
            </p>
            <button
              type="button" onClick={onFechar}
              className="mt-2 px-4 py-2 rounded-lg text-xs font-semibold text-[#070707]"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
            >
              Fechar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[#555] text-[10px] uppercase tracking-wider block mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>Valor</label>
              <input
                type="text" inputMode="decimal" placeholder="0,00" value={valor}
                onChange={e => setValor(e.target.value.replace(/[^\d,.]/g, ''))}
                className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: '#111', border: '1px solid #1e1e1e', fontFamily: 'var(--font-dm-sans)' }}
              />
            </div>
            <div>
              <label className="text-[#555] text-[10px] uppercase tracking-wider block mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>Motivo (opcional)</label>
              <input
                type="text" placeholder="Ex: entreguei pro cofre" value={motivo}
                onChange={e => setMotivo(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: '#111', border: '1px solid #1e1e1e', fontFamily: 'var(--font-dm-sans)' }}
              />
            </div>
            <div>
              <label className="text-[#555] text-[10px] uppercase tracking-wider block mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                PIN/senha de quem está retirando
              </label>
              <input
                type="password" placeholder="Código de autorização" value={codigo}
                onChange={e => setCodigo(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: '#111', border: '1px solid #1e1e1e', fontFamily: 'var(--font-dm-sans)' }}
              />
              <p className="text-[#444] text-[10px] mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Não é o login de quem está com o caixa — é o código de quem está pegando o dinheiro agora.
              </p>
            </div>
            {erro && <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>}
            <button
              type="button" onClick={confirmar} disabled={enviando}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar sangria'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
