'use client'

// Rota pública /caixa — login alternativo por token+PIN (design combinado
// 19/08/2026, ver project_token_pin_acesso_caixa na memória). É a URL fixa
// que fica salva no PC compartilhado do balcão / configurada na maquininha,
// pra abrir sessão sem precisar de conta Google/email+senha ali. Emite a
// MESMA sessão JWT do login normal (POST /auth/entrar-com-pin), então daqui
// pra frente é sessão normal pro resto do sistema — zero código novo em
// nenhuma tela existente.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { setSessionFromAccessToken } from '@/lib/auth/session'
import { apiFetchAuth } from '@/lib/apiFetch'
import { buildAcessos } from '@/lib/buildAcessos'

const ACCENT = '#E8B84B'

// Fase A do plano de redirect inteligente (ver docs/plano-terminais-caixa-pwa.md,
// 24/08/2026): em vez de sempre cair no hub `/trabalho/[eventoId]`, decide
// pra onde mandar direto, olhando (nessa ordem):
//   1. Caixa ABERTO agora (bilheteria ou estacionamento) — é onde a pessoa
//      está trabalhando neste minuto, prioridade sobre qualquer outra coisa.
//   2. Sem caixa aberto: dono do evento sempre cai no hub (quer ver o painel
//      geral, não ser jogado numa tela operacional).
//   3. Sem caixa aberto, não é dono: se ela só tem 1 ferramenta possível
//      (buildAcessos), cai direto nela. Se tem mais de uma (ou nenhuma),
//      cai no hub — só aí que sobra ambiguidade real pra resolver na mão.
// Qualquer erro nessas checagens cai no hub também — nunca trava o login.
async function decidirDestino(eventId: string): Promise<string> {
  const hub = `/trabalho/${eventId}`
  try {
    const resCaixa = await apiFetchAuth(`/api/eventos/${eventId}/meu-caixa`)
    if (resCaixa.ok) {
      const caixa = await resCaixa.json() as { id: string; estacionamentoId: string | null } | null
      if (caixa) {
        return caixa.estacionamentoId ? `/estacionamento/${eventId}` : `/bilheteria/${eventId}/caixa/${caixa.id}`
      }
    }

    const resAcesso = await apiFetchAuth(`/api/eventos/${eventId}/meu-acesso`)
    if (!resAcesso.ok) return hub
    const acesso = await resAcesso.json() as { isOwner: boolean; staff: { permissions: string[] } | null }
    if (acesso.isOwner) return hub

    const acessos = buildAcessos(eventId, acesso.staff?.permissions ?? [], false)
    return acessos.length === 1 ? acessos[0].href : hub
  } catch {
    return hub
  }
}

export function CaixaLoginClient() {
  const router = useRouter()
  const [token, setToken]       = useState('')
  const [pin, setPin]           = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro]         = useState<string | null>(null)

  async function entrar() {
    setErro(null)
    if (token.length !== 8) { setErro('Token deve ter 8 dígitos'); return }
    if (!/^\d{4}$|^\d{6}$/.test(pin)) { setErro('PIN deve ter 4 ou 6 dígitos'); return }

    setEnviando(true)
    try {
      const res = await fetch('/api/auth/entrar-com-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, pin }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(data.message ?? data.error ?? 'Não foi possível entrar.')
        return
      }
      setSessionFromAccessToken(data.accessToken)
      const destino = await decidirDestino(data.eventId)
      router.push(destino)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-6" style={{ background: '#070707' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: `${ACCENT}12`, border: `1px solid ${ACCENT}30` }}
          >
            <KeyRound size={24} style={{ color: ACCENT }} />
          </div>
          <h1 className="text-white text-xl font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            Acesso ao caixa
          </h1>
          <p className="text-[#555] text-sm text-center mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Digite o token e o PIN do seu turno neste evento.
          </p>
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => { e.preventDefault(); if (!enviando) entrar() }}
        >
          <div>
            <label className="text-[#555] text-[10px] uppercase tracking-wider block mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Token (8 dígitos)
            </label>
            <input
              autoFocus
              inputMode="numeric"
              placeholder="00000000"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="w-full rounded-lg px-3 py-3 text-base text-white outline-none tracking-[0.2em] text-center"
              style={{ background: '#111', border: '1px solid #1e1e1e', fontFamily: 'var(--font-dm-sans)' }}
            />
          </div>

          <div>
            <label className="text-[#555] text-[10px] uppercase tracking-wider block mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              placeholder="4 ou 6 dígitos"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-lg px-3 py-3 text-base text-white outline-none tracking-[0.3em] text-center"
              style={{ background: '#111', border: '1px solid #1e1e1e', fontFamily: 'var(--font-dm-sans)' }}
            />
          </div>

          {erro && (
            <p className="flex items-center gap-1.5 text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <AlertCircle size={13} /> {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando || !token || !pin}
            className="w-full py-3 rounded-lg text-sm font-semibold text-[#070707] disabled:opacity-40 flex items-center justify-center gap-2 mt-2"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
          >
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <>Entrar <ArrowRight size={15} /></>}
          </button>
        </form>

        <p className="text-[#333] text-xs text-center mt-6" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          O token e o PIN ficam em &quot;Meus trabalhos&quot; dentro da sua conta.
        </p>
      </div>
    </div>
  )
}
