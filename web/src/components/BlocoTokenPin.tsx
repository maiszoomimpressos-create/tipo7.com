'use client'

import { useState } from 'react'
import { KeyRound, Copy, CheckCircle2, Loader2 } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'

const ACCENT = '#E8B84B'

export interface AcessoCaixa {
  staffId:      string
  token:        string | null
  pinDefinido:  boolean
}

// ── Token + PIN (acesso a caixa em PC compartilhado / maquininha) ────────────
// Mostra o token (persiste, não é "mostra uma vez só e some" — a pessoa pode
// reabrir isso quando quiser) e deixa criar/trocar o PIN daquele evento. Não
// faz login nenhum aqui — só prepara a credencial usada em outro lugar
// (rota pública /caixa, ver app/caixa/CaixaLoginClient.tsx, e na sangria).
//
// Compartilhado entre /trabalhos (equipe convidada) e as telas de abrir
// caixa da Bilheteria/Estacionamento (dono do evento) — mesmo formulário,
// mesmo endpoint (POST /trabalhos/pin já aceita qualquer staffId 'active',
// inclusive a linha "invisível" que o dono ganha automaticamente). Token
// sempre vem de nós (não precisa ser memorizável); PIN é sempre a pessoa
// quem escolhe (vai digitar isso o evento inteiro) — nunca gerado por nós,
// nem pro dono (correção de rumo, 20/08/2026, ver
// project_token_pin_acesso_caixa na memória).
export function BlocoTokenPin({ acesso, onPinAtualizado }: { acesso: AcessoCaixa; onPinAtualizado: () => void }) {
  const [pin, setPin]                   = useState('')
  const [confirmarPin, setConfirmarPin] = useState('')
  const [salvando, setSalvando]         = useState(false)
  const [erro, setErro]                 = useState<string | null>(null)
  const [copiado, setCopiado]           = useState(false)

  async function copiarToken() {
    if (!acesso.token) return
    await navigator.clipboard.writeText(acesso.token)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  async function salvarPin() {
    setErro(null)
    if (!/^\d{4}$|^\d{6}$/.test(pin)) { setErro('PIN deve ter 4 ou 6 dígitos numéricos'); return }
    if (pin !== confirmarPin) { setErro('Os dois PINs digitados não coincidem'); return }
    setSalvando(true)
    try {
      const res = await apiFetchAuth('/api/trabalhos/pin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ staffId: acesso.staffId, pin }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.message ?? data.error ?? 'Erro ao salvar PIN'); return }
      setPin(''); setConfirmarPin('')
      onPinAtualizado()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="rounded-xl p-3.5" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
      <div className="flex items-center gap-2 mb-3">
        <KeyRound size={13} style={{ color: ACCENT }} />
        <span className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Acesso ao caixa (token + PIN)
        </span>
      </div>
      <p className="text-[#666] text-xs mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        Use isso pra abrir seu caixa em outro aparelho (PC compartilhado, maquininha) sem precisar logar com sua conta.
      </p>

      <div className="mb-3">
        <label className="text-[#555] text-[10px] uppercase tracking-wider block mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Seu token deste evento
        </label>
        <button
          type="button"
          onClick={copiarToken}
          className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:border-[#E8B84B]/40"
          style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}
        >
          <span className="text-white text-base font-semibold tracking-[0.2em]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {acesso.token ?? '········'}
          </span>
          {copiado ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} className="text-[#444]" />}
        </button>
      </div>

      {acesso.pinDefinido && (
        <p className="flex items-center gap-1.5 text-green-400 text-xs mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <CheckCircle2 size={12} /> PIN já configurado — pode criar um novo abaixo se quiser trocar.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <input
          type="password" inputMode="numeric" placeholder="Novo PIN (4 ou 6 dígitos)"
          value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
          style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', fontFamily: 'var(--font-dm-sans)' }}
        />
        <input
          type="password" inputMode="numeric" placeholder="Confirme o PIN"
          value={confirmarPin} onChange={e => setConfirmarPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
          style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', fontFamily: 'var(--font-dm-sans)' }}
        />
        {erro && <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>}
        <button
          type="button" onClick={salvarPin} disabled={salvando || !pin || !confirmarPin}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-[#070707] disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
        >
          {salvando ? <Loader2 size={14} className="animate-spin" /> : (acesso.pinDefinido ? 'Trocar PIN' : 'Criar PIN')}
        </button>
      </div>
    </div>
  )
}
