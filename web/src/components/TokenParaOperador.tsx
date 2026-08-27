'use client'

// Token de acesso de OUTRA pessoa (não de quem está logado agora), pra
// repassar depois de abrir um caixa pra ela (pedido do usuário, 27/08/2026
// — "abrir caixa = autorização", o dono precisa poder mandar o token na
// hora, não devia depender da pessoa catar sozinha depois em "Meus
// trabalhos"). Bem mais simples que BlocoTokenPin: aqui NÃO dá pra criar
// PIN — PIN só a própria pessoa cria, logada com a conta dela (decisão já
// tomada, ver project_token_pin_acesso_caixa na memória) — só mostra o
// token + ajuda a repassar.
import { useState } from 'react'
import { Copy, CheckCircle2, MessageCircle, X, KeyRound } from 'lucide-react'

const ACCENT = '#E8B84B'

export function TokenParaOperador({ nome, token }: { nome: string; token: string | null }) {
  const [copiado, setCopiado] = useState(false)
  const [enviandoWhats, setEnviandoWhats] = useState(false)
  const [telefone, setTelefone] = useState('')

  async function copiar() {
    if (!token) return
    await navigator.clipboard.writeText(token)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  function enviarPorWhatsapp() {
    if (!token) return
    const digits = telefone.replace(/\D/g, '')
    if (digits.length < 10) return
    const numero = digits.startsWith('55') ? digits : `55${digits}`
    const link = `${window.location.origin}/caixa`
    const texto = `Seu acesso ao caixa Tipo7 (${nome}):\nToken: ${token}\n\nEntre em ${link}, digite esse token e crie seu PIN (se ainda não tiver um).`
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank')
    setEnviandoWhats(false)
  }

  return (
    <div className="rounded-xl p-3.5" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
      <div className="flex items-center gap-2 mb-2.5">
        <KeyRound size={13} style={{ color: ACCENT }} />
        <span className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Token de {nome}
        </span>
      </div>

      <button
        type="button"
        onClick={copiar}
        className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:border-[#E8B84B]/40 mb-2.5"
        style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}
      >
        <span className="text-white text-base font-semibold tracking-[0.2em]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {token ?? '········'}
        </span>
        {copiado ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} className="text-[#444]" />}
      </button>

      <p className="text-[#555] text-xs mb-2.5 leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        O PIN só {nome.split(' ')[0]} pode criar (logando na conta dela). Se ainda não tem um, ela cria em{' '}
        <span className="text-[#888]">Meus trabalhos → Acesso ao caixa</span>, ou entrando direto em <span className="text-[#888]">/caixa</span> com esse token.
      </p>

      <button
        type="button"
        onClick={() => setEnviandoWhats(true)}
        disabled={!token}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium border transition-colors hover:border-[#E8B84B]/40 disabled:opacity-40"
        style={{ borderColor: '#222', color: '#ccc', fontFamily: 'var(--font-dm-sans)' }}
      >
        <MessageCircle size={13} className="text-green-400" />
        Enviar token por WhatsApp
      </button>

      {enviandoWhats && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setEnviandoWhats(false)}>
          <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white text-sm font-medium flex items-center gap-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <MessageCircle size={14} className="text-green-400" /> Enviar token por WhatsApp
              </p>
              <button onClick={() => setEnviandoWhats(false)}><X size={16} className="text-[#444]" /></button>
            </div>
            <p className="text-[#888] text-xs mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Número de {nome} — vai junto o token e o link de acesso.
            </p>
            <input
              type="tel" inputMode="numeric" placeholder="DDD + número"
              value={telefone} onChange={e => setTelefone(e.target.value.replace(/\D/g, ''))}
              autoFocus
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none mb-3"
              style={{ background: '#111', border: '1px solid #1e1e1e', fontFamily: 'var(--font-dm-sans)' }}
            />
            <button
              type="button" onClick={enviarPorWhatsapp} disabled={telefone.replace(/\D/g, '').length < 10}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-[#070707] disabled:opacity-40"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
            >
              Abrir WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
