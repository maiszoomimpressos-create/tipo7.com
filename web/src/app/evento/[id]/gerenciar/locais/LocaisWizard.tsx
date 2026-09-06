'use client'

import { useState, useEffect, useCallback } from 'react'
import { Car, ShoppingCart, UtensilsCrossed, Check, Loader2, Plus, Wallet, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetchAuth } from '@/lib/apiFetch'
import { GerenciadorEstacionamentos } from '@/app/estacionamento/[eventoId]/GerenciadorEstacionamentos'
import { GerenciadorBilheterias } from '@/app/bilheteria/[eventoId]/GerenciadorBilheterias'

const ACCENT = '#E8B84B'

type StepId = 'estacionamento' | 'bilheteria' | 'tenda'

const STEPS: { id: StepId; label: string; icon: React.ElementType }[] = [
  { id: 'estacionamento', label: 'Estacionamento', icon: Car },
  { id: 'bilheteria',     label: 'Bilheteria',      icon: ShoppingCart },
  { id: 'tenda',          label: 'Tenda',           icon: UtensilsCrossed },
]

interface Props {
  eventoId:    string
  eventoTitle: string
  moduloEstacionamentoInicial: boolean
}

// Pedido do usuário (03/09/2026): em vez de 3 telas soltas (Estacionamento/
// Bilheteria/Tenda cada uma com seu próprio botão de navegação, "bagunçado"
// nas palavras dele), um fluxo único e sequencial — cada setor pergunta
// "nome + quantos caixas" (mesmo método já usado no Estacionamento pra
// portões), passo a passo. Reaproveita os componentes que já existiam
// (GerenciadorEstacionamentos, GerenciadorBilheterias) como conteúdo de
// cada passo — não recria a lógica deles, só junta num fluxo só.
export function LocaisWizard({ eventoId, eventoTitle, moduloEstacionamentoInicial }: Props) {
  const [passo, setPasso] = useState(0)
  const [moduloEstacionamento, setModuloEstacionamento] = useState(moduloEstacionamentoInicial)

  const stepAtual = STEPS[passo].id

  return (
    <div className="flex flex-col gap-6">
      {/* Indicador de passos — clicável (não é obrigatório seguir em ordem,
          os 3 setores são independentes), mas a ordem sugerida em Next/
          Voltar segue a sequência combinada com o usuário. */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const ativo = i === passo
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setPasso(i)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: ativo ? `${ACCENT}12` : 'transparent',
                color:      ativo ? ACCENT : '#555',
                border:     `1px solid ${ativo ? `${ACCENT}35` : '#1a1a1a'}`,
                fontFamily: 'var(--font-dm-sans)',
              }}
            >
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                style={{ background: ativo ? ACCENT : '#1c1c1c', color: ativo ? '#070707' : '#666' }}
              >
                {i + 1}
              </span>
              <Icon size={13} />
              {s.label}
            </button>
          )
        })}
      </div>

      {stepAtual === 'estacionamento' && (
        moduloEstacionamento ? (
          <GerenciadorEstacionamentos eventoId={eventoId} eventoTitle={eventoTitle} embutido />
        ) : (
          <AtivarEstacionamento eventoId={eventoId} onAtivado={() => setModuloEstacionamento(true)} />
        )
      )}

      {stepAtual === 'bilheteria' && (
        <GerenciadorBilheterias eventoId={eventoId} eventoTitle={eventoTitle} embutido />
      )}

      {stepAtual === 'tenda' && (
        <TendaStep eventoId={eventoId} />
      )}

      {/* Navegação sequencial — reforça a ordem sugerida sem travar quem
          clicar direto num passo lá em cima. */}
      <div className="flex items-center justify-between pt-2 border-t border-[#141414]">
        <button type="button" onClick={() => setPasso(p => Math.max(0, p - 1))} disabled={passo === 0}
          className="px-4 py-2 rounded-xl text-xs font-medium border border-[#1e1e1e] text-[#777] disabled:opacity-30 transition-colors"
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Voltar
        </button>
        {passo < STEPS.length - 1 ? (
          <button type="button" onClick={() => setPasso(p => Math.min(STEPS.length - 1, p + 1))}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#070707]"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
            Próximo — {STEPS[passo + 1].label}
          </button>
        ) : (
          <a href={`/evento/${eventoId}/gerenciar/equipe`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#070707]"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
            <Check size={13} /> Concluído — ir pra Equipe
          </a>
        )}
      </div>
    </div>
  )
}

// Mesma lógica de EstacionamentoAtivacaoClient.tsx (só movida pra dentro do
// passo do wizard, em vez de bloquear a rota inteira).
function AtivarEstacionamento({ eventoId, onAtivado }: { eventoId: string; onAtivado: () => void }) {
  const [ativando, setAtivando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function ativar() {
    setAtivando(true); setErro(null)
    try {
      const res = await apiFetchAuth(`/api/eventos/${eventoId}/modulos`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ moduloEstacionamento: true }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao ativar'); return }
      onAtivado()
    } finally {
      setAtivando(false)
    }
  }

  return (
    <div className="flex flex-col items-center text-center gap-3 py-10">
      <Car size={28} className="text-[#444]" />
      <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        Estacionamento ainda não está ativado neste evento
      </p>
      <p className="text-[#555] text-xs max-w-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        Pode ativar a qualquer momento, mesmo com o evento já publicado — não afeta o que já está configurado.
      </p>
      {erro && <p className="text-red-400 text-xs">{erro}</p>}
      <button type="button" onClick={ativar} disabled={ativando}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-40"
        style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
        {ativando ? <Loader2 size={14} className="animate-spin" /> : <Car size={14} />}
        Ativar estacionamento
      </button>
    </div>
  )
}

interface Tenda {
  id:           string
  title:        string | null
  status:       string
  qtdCaixas:    number
}

// Tenda é um EVENTO FILHO de verdade (não um local simples como Estacio-
// namento/Bilheteria) — tem catálogo de ingresso próprio, status de
// publicação etc. Pra caber no mesmo padrão "nome + quantos caixas" que o
// usuário pediu, esse passo só cuida da CASCA (criar o filho + os caixas
// dele) — "o que é vendido lá" continua no fluxo de ingressos já existente
// pro evento filho (link "Configurar itens vendidos" abaixo), porque é uma
// etapa genuinamente diferente (catálogo/preço), não "local e caixa".
function TendaStep({ eventoId }: { eventoId: string }) {
  const [tendas, setTendas]         = useState<Tenda[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro]             = useState<string | null>(null)
  const [criando, setCriando]       = useState(false)
  const [nome, setNome]             = useState('')
  const [qtdCaixas, setQtdCaixas]   = useState(1)

  const carregar = useCallback(async () => {
    const res = await apiFetchAuth(`/api/eventos/${eventoId}/criar-filho`)
    const data = await res.json() as { filhos: { id: string; title: string | null; status: string; modulo_tenda: boolean }[] }
    const soTendas = (data.filhos ?? []).filter(f => f.modulo_tenda)
    const comCaixas = await Promise.all(soTendas.map(async t => {
      const resC = await apiFetchAuth(`/api/eventos/${t.id}/caixas`)
      const dataC = await resC.json() as { caixas: unknown[] }
      return { id: t.id, title: t.title, status: t.status, qtdCaixas: (dataC.caixas ?? []).length }
    }))
    setTendas(comCaixas)
    setCarregando(false)
  }, [eventoId])

  useEffect(() => { carregar() }, [carregar])

  const criar = async () => {
    if (!nome.trim()) return
    setCriando(true); setErro(null)
    try {
      const res = await apiFetchAuth(`/api/eventos/${eventoId}/criar-filho`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ titulo: nome.trim(), moduloTenda: true, moduloIngressos: true }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.message ?? data.error ?? 'Erro ao criar tenda'); return }

      if (qtdCaixas > 0) {
        await apiFetchAuth(`/api/eventos/${data.id}/caixas/gerar`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ quantidade: qtdCaixas }),
        })
      }

      setNome(''); setQtdCaixas(1)
      await carregar()
    } finally {
      setCriando(false)
    }
  }

  const adicionarCaixa = async (tendaId: string) => {
    await apiFetchAuth(`/api/eventos/${tendaId}/caixas/gerar`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ quantidade: 1 }),
    })
    await carregar()
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <p className="text-red-400 text-xs">{erro}</p>}
      {carregando && <Loader2 size={20} className="animate-spin text-[#E8B84B] mx-auto my-6" />}

      {!carregando && (
        <>
          {tendas.length === 0 && (
            <p className="text-[#444] text-sm text-center py-4">Nenhuma tenda configurada ainda.</p>
          )}

          {tendas.map(t => (
            <div key={t.id} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {t.title} {t.status === 'rascunho' && <span className="text-[#444] text-xs">(rascunho)</span>}
                </p>
                <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {t.qtdCaixas} caixa(s)
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button type="button" onClick={() => adicionarCaixa(t.id)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium border border-[#222] text-[#aaa] hover:border-[#E8B84B]/40 hover:text-[#E8B84B] transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  <Wallet size={11} /> +1 caixa
                </button>
                <a href={`/criar-evento/${t.id}/ingressos`}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium border border-[#222] text-[#aaa] hover:border-[#E8B84B]/40 hover:text-[#E8B84B] transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Itens vendidos <ExternalLink size={10} />
                </a>
              </div>
            </div>
          ))}

          <div className="h-px bg-[#141414] my-1" />

          <p className="text-[#666] text-xs uppercase tracking-widest font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Nova tenda
          </p>
          <input type="text" placeholder="Nome (ex: Tenda de bebidas) *" value={nome}
            onChange={e => setNome(e.target.value)}
            className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
            style={{ fontFamily: 'var(--font-dm-sans)' }} />

          <p className="text-[#444] text-[11px] uppercase tracking-wider">Quantos caixas essa tenda vai ter?</p>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(qtd => (
              <button key={qtd} type="button" onClick={() => setQtdCaixas(qtd)}
                className={cn(
                  'py-2.5 rounded-xl border text-xs font-medium transition-all',
                  qtdCaixas === qtd ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35 text-white' : 'bg-[#111] border-[#1c1c1c] text-[#777]'
                )}>
                {qtd}
              </button>
            ))}
          </div>

          <button type="button" onClick={criar} disabled={criando || !nome.trim()}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
            {criando ? <Loader2 size={15} className="animate-spin" /> : <><Plus size={14} /> Criar tenda</>}
          </button>
          <p className="text-[#444] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Cria a tenda (como um evento próprio dentro do seu evento, mesma data/local) e os caixas já abertos,
            sem operador. O que é vendido nela (itens, preços) você configura depois, em &quot;Itens vendidos&quot;.
          </p>
        </>
      )}
    </div>
  )
}
