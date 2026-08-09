'use client'

// Assistente pós-pagamento — só aparece quando o mesmo comprador leva mais
// de um ingresso pro mesmo evento (nessa compra, ou já tinha de uma
// anterior). Em vez de assumir que todos os ingressos são dele, oferece
// preencher com os próprios dados o que for dele e, pro resto, escolher
// entre preencher na hora ou mandar um link pra cada pessoa se cadastrar.
// Pedido do usuário, 09/08/2026.
import { useEffect, useState } from 'react'
import { Loader2, Users, Link2, Check, Copy, MessageCircle } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'

interface Resumo {
  event_title:                  string
  total_slots:                  number
  filled_slots:                 number
  ja_tem_ingresso_nesse_evento: boolean
}

type Passo = 'carregando' | 'oculto' | 'pergunta_self' | 'distribuir' | 'link' | 'fim'

export function HolderWizard({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [passo, setPasso]   = useState<Passo>('carregando')
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [restantes, setRestantes] = useState(0)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    apiFetchAuth(`/api/orders/${orderId}/holder-resumo`)
      .then(res => res.ok ? res.json() : null)
      .then((d: Resumo | null) => {
        if (!d) { setPasso('oculto'); return }
        setResumo(d)
        const livres = d.total_slots - d.filled_slots
        // Só vale a pena perguntar quando há mais de 1 ingresso do mesmo
        // comprador nesse evento (essa compra, ou combinado com uma
        // anterior) — 1 ingresso sozinho segue o fluxo normal, sem assistente.
        const relevante = (d.total_slots > 1 || d.ja_tem_ingresso_nesse_evento) && livres > 0
        if (!relevante) { setPasso('oculto'); return }
        setRestantes(livres)
        setPasso(d.ja_tem_ingresso_nesse_evento ? 'distribuir' : 'pergunta_self')
      })
      .catch(() => setPasso('oculto'))
  }, [orderId])

  useEffect(() => {
    if (passo === 'oculto') onDone()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo])

  async function usarMeusDados() {
    setBusy(true); setErro(null)
    try {
      const res = await apiFetchAuth(`/api/orders/${orderId}/holder-preencher-meus-dados`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json().catch(() => null) as { message?: string } | null
        setErro(d?.message ?? 'Não foi possível preencher com seus dados.')
        return
      }
      const sobrando = restantes - 1
      setRestantes(sobrando)
      setPasso(sobrando > 0 ? 'distribuir' : 'fim')
    } finally {
      setBusy(false)
    }
  }

  async function gerarLink() {
    setBusy(true); setErro(null)
    try {
      const res = await apiFetchAuth(`/api/orders/${orderId}/holder-link`, { method: 'POST' })
      if (!res.ok) {
        setErro('Não foi possível gerar o link. Tente de novo.')
        return
      }
      const d = await res.json() as { token: string }
      setLink(`${window.location.origin}/portador/${d.token}`)
      setPasso('link')
    } finally {
      setBusy(false)
    }
  }

  async function copiarLink() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  if (passo === 'carregando' || passo === 'oculto' || !resumo) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 size={20} className="animate-spin text-[#333]" />
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col gap-4 rounded-2xl p-5" style={{ border: '1px solid #1a1a1a', background: '#0d0d0d' }}>

      <div className="flex items-center gap-2">
        <Users size={15} className="text-[#E8B84B]" />
        <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          {passo === 'pergunta_self' ? 'Um desses ingressos é seu?' : 'Ingressos restantes'}
        </p>
      </div>

      {passo === 'pergunta_self' && (
        <>
          <p className="text-[#666] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Você comprou {resumo.total_slots} ingressos pra {resumo.event_title}. Algum deles é pra você mesmo?
          </p>
          <div className="flex gap-2">
            <button
              type="button" onClick={usarMeusDados} disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-[#070707] disabled:opacity-60"
              style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : 'Sim, um é meu'}
            </button>
            <button
              type="button" onClick={() => setPasso('distribuir')} disabled={busy}
              className="flex-1 py-2.5 rounded-xl text-xs text-[#888] border border-[#222] hover:border-[#333] transition-colors disabled:opacity-60"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Não, são pra outras pessoas
            </button>
          </div>
        </>
      )}

      {passo === 'distribuir' && (
        <>
          <p className="text-[#666] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Faltam {restantes} {restantes === 1 ? 'ingresso' : 'ingressos'} de {resumo.event_title} sem portador. Como prefere preencher?
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button" onClick={onDone} disabled={busy}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-[#070707] disabled:opacity-60"
              style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
            >
              Vou preencher eu mesmo agora
            </button>
            <button
              type="button" onClick={gerarLink} disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs text-[#888] border border-[#222] hover:border-[#333] transition-colors disabled:opacity-60"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <><Link2 size={13} /> Mandar um link pra cada pessoa preencher</>}
            </button>
          </div>
        </>
      )}

      {passo === 'link' && link && (
        <>
          <p className="text-[#666] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Compartilhe esse link — cada pessoa que abrir preenche os próprios dados e recebe o ingresso dela por WhatsApp e email.
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-[#222] bg-[#0a0a0a] px-3 py-2.5">
            <p className="flex-1 text-[#999] text-xs truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>{link}</p>
            <button type="button" onClick={copiarLink} className="shrink-0 text-[#E8B84B]">
              {copiado ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <div className="flex gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Reivindica seu ingresso pra ${resumo.event_title} aqui: ${link}`)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(37,211,102,0.1)', color: '#25D366', border: '1px solid rgba(37,211,102,0.25)', fontFamily: 'var(--font-dm-sans)' }}
            >
              <MessageCircle size={13} /> Enviar por WhatsApp
            </a>
            <button
              type="button" onClick={onDone}
              className="flex-1 py-2.5 rounded-xl text-xs text-[#888] border border-[#222] hover:border-[#333] transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Concluir
            </button>
          </div>
        </>
      )}

      {passo === 'fim' && (
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-[#888] text-xs text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Prontinho! Seu ingresso já está preenchido.
          </p>
          <button
            type="button" onClick={onDone}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-[#070707]"
            style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
          >
            Continuar
          </button>
        </div>
      )}

      {erro && <p className="text-red-400 text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>}

      {passo !== 'link' && passo !== 'fim' && (
        <button
          type="button" onClick={onDone}
          className="text-[#444] hover:text-[#888] text-[11px] transition-colors self-center"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          Pular, decidir depois
        </button>
      )}
    </div>
  )
}
