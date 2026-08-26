'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Copy, CheckCircle2, Loader2, Download, MessageCircle, AlertCircle, X, Share } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'
import { usePwaInstall, isIOSSafari } from '@/lib/pwaInstall'

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

      {/* Instalar / enviar link — só depois do PIN já configurado (Fase B
          do plano, 24/08/2026, ver docs/plano-terminais-caixa-pwa.md).
          Token/PIN continuam nunca ficando salvos em lugar nenhum — só o
          atalho de acesso (ícone instalado, ou o link puro no WhatsApp,
          sem token/PIN embutidos) fica salvo. */}
      {acesso.pinDefinido && <AcessoRapido />}
    </div>
  )
}

// Botão "Instalar neste aparelho" — comportamento muda por plataforma:
// Android/Chrome/Edge/desktop instala de verdade com 1 clique
// (beforeinstallprompt, ver web/src/lib/pwaInstall.ts); iOS Safari não tem
// API pra isso (limitação da Apple), então mostra o passo manual em vez de
// fingir que instala. Se nenhum dos dois casos se aplica (já instalado, ou
// navegador sem suporte), o botão nem aparece — não adianta oferecer algo
// que não faz nada.
function AcessoRapido() {
  const router = useRouter()
  const { disponivel, jaInstalado, instalar } = usePwaInstall()
  const [instrucaoIOS, setInstrucaoIOS] = useState(false)
  const [enviandoWhats, setEnviandoWhats] = useState(false)
  const [telefone, setTelefone] = useState('')

  const ios = isIOSSafari()
  const mostrarInstalar = disponivel || (ios && !jaInstalado)

  // Achado real (26/08/2026): este botão fica em telas fora de /caixa
  // (/trabalhos, gerenciar do evento) — logado com a conta pessoal. No
  // Chrome desktop, aceitar o prompt de instalação abre a ABA ATUAL como
  // janela do app; `start_url` do manifest só é garantido em relançamentos
  // futuros pelo ícone, não no instante da instalação. Resultado real
  // reportado: instalava e abria mostrando a tela de "Meus trabalhos" da
  // conta pessoal — sem sentido pra um acesso que devia ser independente do
  // login (token+PIN). Fix: navegar pra /caixa ANTES de aceitar o prompt, o
  // pushState já muda window.location antes do React desmontar este
  // componente, então a instalação nasce no lugar certo.
  async function instalarNoCaixa() {
    router.push('/caixa')
    await instalar()
  }

  function enviarPorWhatsapp() {
    const digits = telefone.replace(/\D/g, '')
    if (digits.length < 10) return
    const numero = digits.startsWith('55') ? digits : `55${digits}`
    const link = `${window.location.origin}/caixa`
    const texto = `Acesso ao caixa Tipo7: ${link}\nDigite seu token e PIN pra entrar.`
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank')
    setEnviandoWhats(false)
  }

  return (
    <div className="flex flex-col gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #1e1e1e' }}>
      <div className="flex gap-2">
        {mostrarInstalar && (
          <button
            type="button"
            onClick={() => ios ? setInstrucaoIOS(true) : instalarNoCaixa()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium border transition-colors hover:border-[#E8B84B]/40"
            style={{ borderColor: '#222', color: '#ccc', fontFamily: 'var(--font-dm-sans)' }}
          >
            <Download size={13} style={{ color: ACCENT }} />
            Instalar neste aparelho
          </button>
        )}
        <button
          type="button"
          onClick={() => setEnviandoWhats(true)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium border transition-colors hover:border-[#E8B84B]/40"
          style={{ borderColor: '#222', color: '#ccc', fontFamily: 'var(--font-dm-sans)' }}
        >
          <MessageCircle size={13} className="text-green-400" />
          Enviar link por WhatsApp
        </button>
      </div>

      {/* Instrução manual iOS — não existe API pra instalar por código lá */}
      {instrucaoIOS && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setInstrucaoIOS(false)}>
          <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white text-sm font-medium flex items-center gap-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <AlertCircle size={14} style={{ color: ACCENT }} /> Instalar no iPhone
              </p>
              <button onClick={() => setInstrucaoIOS(false)}><X size={16} className="text-[#444]" /></button>
            </div>
            <p className="text-[#aaa] text-xs leading-relaxed mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              O iPhone não deixa instalar direto pelo botão — é rapidinho na mão:
            </p>
            <ol className="text-[#ccc] text-xs flex flex-col gap-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <li className="flex items-center gap-2"><Share size={13} style={{ color: ACCENT }} /> Toque no botão Compartilhar do Safari</li>
              <li>2. Escolha &quot;Adicionar à Tela de Início&quot;</li>
              <li>3. Toque em &quot;Adicionar&quot;</li>
            </ol>
          </div>
        </div>
      )}

      {/* Enviar link por WhatsApp — pede o número, abre o WhatsApp com a
          mensagem pronta (wa.me), a pessoa confirma o envio ela mesma. Sem
          integração de backend nova — mais rápido de entregar e sem
          depender de coordenação externa (a integração de WhatsApp que já
          existe, Boot Whats, só manda textos por template fixo dela, não
          texto livre). */}
      {enviandoWhats && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setEnviandoWhats(false)}>
          <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white text-sm font-medium flex items-center gap-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <MessageCircle size={14} className="text-green-400" /> Enviar link por WhatsApp
              </p>
              <button onClick={() => setEnviandoWhats(false)}><X size={16} className="text-[#444]" /></button>
            </div>
            <p className="text-[#888] text-xs mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Manda só o link — token e PIN você digita na hora, no aparelho novo.
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
