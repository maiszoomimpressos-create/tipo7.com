'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Car, Plus, Loader2, Clock, Banknote, CreditCard, Smartphone, Gift, X, ArrowLeft, DoorOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { calcularValorEstacionamento } from '@/lib/estacionamentoPricing'
import { ImpressoraBluetooth } from '@/components/ImpressoraBluetooth'

const ACCENT = '#E8B84B'

interface Portao {
  id:    string
  nome:  string
  tipo:  'entrada' | 'saida' | 'ambos'
  ativo: boolean
}

interface Estacionamento {
  id:                    string
  nome:                  string
  cobra_modo:            'gratis' | 'fixo' | 'por_tempo'
  preco_fixo:            number | null
  preco_primeira_hora:   number | null
  preco_hora_adicional:  number | null
  teto_diario:           number | null
  tolerancia_minutos:    number
  controla_saida:        boolean
  vagas_totais:          number | null
  estacionamento_portoes: Portao[]
}

interface Sessao {
  id:                string
  estacionamento_id: string
  placa:             string
  nome_condutor:     string | null
  entrada_em:        string
  estacionamentos:   { nome: string } | null
}

interface Props {
  eventoId:        string
  eventoTitle:     string
  estacionamentos: Estacionamento[]
  caixaId:         string | null
  caixaNome:       string | null
  podeEntrada:     boolean
  podeSaida:       boolean
  portaoRestrito:  string | null
}

const inp = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]'

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function tempoDecorrido(entradaEm: string): string {
  const ms  = Date.now() - new Date(entradaEm).getTime()
  const min = Math.max(0, Math.floor(ms / 60_000))
  const h   = Math.floor(min / 60)
  const m   = min % 60
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

export function AtendenteClient({ eventoId, eventoTitle, estacionamentos, caixaId, caixaNome, podeEntrada, podeSaida, portaoRestrito }: Props) {
  const router = useRouter()
  const [estacionamentoId, setEstacionamentoId] = useState(estacionamentos[0]?.id ?? '')
  const [placa, setPlaca] = useState('')
  const [nomeCondutor, setNomeCondutor] = useState('')
  const [telefoneCondutor, setTelefoneCondutor] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [formaPagamentoEntrada, setFormaPagamentoEntrada] = useState<'dinheiro' | 'pix' | 'cartao' | 'cortesia'>('dinheiro')
  const [portaoEntradaSel, setPortaoEntradaSel] = useState('')
  const [portaoSaidaSel,   setPortaoSaidaSel]   = useState('')

  const [sessoes, setSessoes] = useState<Sessao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [, setTick] = useState(0)

  const [saidaAlvo, setSaidaAlvo] = useState<Sessao | null>(null)
  const [formaPagamento, setFormaPagamento] = useState<'dinheiro' | 'pix' | 'cartao' | 'cortesia'>('dinheiro')
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)

  const carregarSessoes = useCallback(async () => {
    const res  = await fetch(`/api/estacionamento/${eventoId}/sessoes?status=aberto`)
    const data = await res.json()
    setSessoes(data.sessoes ?? [])
    setCarregando(false)
  }, [eventoId])

  useEffect(() => { carregarSessoes() }, [carregarSessoes])

  // Atualiza o tempo decorrido exibido a cada minuto
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Recarrega a lista de carros periodicamente — pega entrada/saída registrada
  // por outro atendente em outro aparelho, mantendo a contagem de vagas em dia.
  useEffect(() => {
    const id = setInterval(() => { carregarSessoes() }, 20_000)
    return () => clearInterval(id)
  }, [carregarSessoes])

  const valorPreview = useMemo(() => {
    if (!saidaAlvo) return 0
    const config = estacionamentos.find(e => e.id === saidaAlvo.estacionamento_id)
    if (!config) return 0
    // Preço fixo já foi cobrado na entrada — na saída não há mais nada a cobrar.
    if (config.cobra_modo === 'fixo') return 0
    return calcularValorEstacionamento(config, saidaAlvo.entrada_em, new Date())
  }, [saidaAlvo, estacionamentos])

  // Ocupação do lote selecionado — recalcula sozinho toda vez que a lista de
  // sessões abertas muda (entrada nova ocupa, saída libera).
  const estacionamentoAtual = estacionamentos.find(e => e.id === estacionamentoId) ?? null
  const vagasOcupadas = sessoes.filter(s => s.estacionamento_id === estacionamentoId).length
  const vagasTotais   = estacionamentoAtual?.vagas_totais ?? null
  const lotado        = vagasTotais != null && vagasOcupadas >= vagasTotais

  // Preço fixo cobra na entrada — por_tempo continua cobrando só na saída.
  const precoEntradaFixo   = estacionamentoAtual?.cobra_modo === 'fixo' ? Number(estacionamentoAtual.preco_fixo ?? 0) : 0
  const precisaPagarEntrada = precoEntradaFixo > 0
  const precisaCaixaEntrada = precisaPagarEntrada && formaPagamentoEntrada !== 'cortesia'

  // Portões de entrada disponíveis pro estacionamento selecionado — se o
  // atendente estiver restrito a um portão específico, só esse aparece.
  const portoesEntradaDisponiveis = useMemo(() => {
    const todos = (estacionamentoAtual?.estacionamento_portoes ?? []).filter(p => p.ativo && ['entrada', 'ambos'].includes(p.tipo))
    return portaoRestrito ? todos.filter(p => p.id === portaoRestrito) : todos
  }, [estacionamentoAtual, portaoRestrito])
  const precisaPortaoEntrada = (estacionamentoAtual?.estacionamento_portoes?.length ?? 0) > 0

  useEffect(() => {
    if (portoesEntradaDisponiveis.length === 1) { setPortaoEntradaSel(portoesEntradaDisponiveis[0].id); return }
    if (!portoesEntradaDisponiveis.some(p => p.id === portaoEntradaSel)) setPortaoEntradaSel('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portoesEntradaDisponiveis])

  const handleRegistrarEntrada = async () => {
    if (!estacionamentoId || !placa.trim() || lotado) return
    if (precisaPortaoEntrada && !portaoEntradaSel) {
      setErro('Selecione o portão de entrada.')
      return
    }
    if (precisaCaixaEntrada && !caixaId) {
      setErro('Nenhum caixa aberto designado pra você. Peça pro organizador abrir e designar um caixa.')
      return
    }
    setRegistrando(true); setErro(null)
    try {
      const res = await fetch('/api/estacionamento/entrada', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          estacionamentoId,
          placa:             placa.trim(),
          nomeCondutor:      nomeCondutor.trim()     || undefined,
          telefoneCondutor:  telefoneCondutor.trim() || undefined,
          formaPagamento:    precisaPagarEntrada ? formaPagamentoEntrada : undefined,
          caixaId:           precisaCaixaEntrada ? caixaId ?? undefined : undefined,
          portaoId:          precisaPortaoEntrada ? portaoEntradaSel : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao registrar entrada'); return }
      setPlaca(''); setNomeCondutor(''); setTelefoneCondutor(''); setFormaPagamentoEntrada('dinheiro')
      await carregarSessoes()
    } catch {
      setErro('Erro ao registrar entrada. Tente novamente.')
    } finally {
      setRegistrando(false)
    }
  }

  const abrirConfirmarSaida = (s: Sessao) => {
    setSaidaAlvo(s)
    setFormaPagamento('dinheiro')
    setErro(null)
    const config = estacionamentos.find(e => e.id === s.estacionamento_id)
    const disponiveis = (config?.estacionamento_portoes ?? []).filter(p => p.ativo && ['saida', 'ambos'].includes(p.tipo))
    const filtrados   = portaoRestrito ? disponiveis.filter(p => p.id === portaoRestrito) : disponiveis
    setPortaoSaidaSel(filtrados.length === 1 ? filtrados[0].id : '')
  }

  // Portões de saída disponíveis pro estacionamento da sessão em confirmação —
  // o carro pode sair por qualquer portão tipo saída/ambos, não precisa ser
  // o mesmo por onde entrou.
  const portoesSaidaDisponiveis = useMemo(() => {
    if (!saidaAlvo) return []
    const config = estacionamentos.find(e => e.id === saidaAlvo.estacionamento_id)
    const todos = (config?.estacionamento_portoes ?? []).filter(p => p.ativo && ['saida', 'ambos'].includes(p.tipo))
    return portaoRestrito ? todos.filter(p => p.id === portaoRestrito) : todos
  }, [saidaAlvo, estacionamentos, portaoRestrito])
  const precisaPortaoSaida = !!saidaAlvo &&
    ((estacionamentos.find(e => e.id === saidaAlvo.estacionamento_id)?.estacionamento_portoes?.length ?? 0) > 0)

  const handleConfirmarSaida = async () => {
    if (!saidaAlvo) return
    const config = estacionamentos.find(e => e.id === saidaAlvo.estacionamento_id)
    const precisaCaixa = config?.cobra_modo !== 'gratis' && formaPagamento !== 'cortesia' && valorPreview > 0

    if (precisaPortaoSaida && !portaoSaidaSel) {
      setErro('Selecione o portão de saída.')
      return
    }
    if (precisaCaixa && !caixaId) {
      setErro('Nenhum caixa aberto designado pra você. Peça pro organizador abrir e designar um caixa.')
      return
    }

    setConfirmandoSaida(true); setErro(null)
    try {
      const res = await fetch('/api/estacionamento/saida', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          sessaoId:       saidaAlvo.id,
          caixaId:        precisaCaixa ? caixaId : undefined,
          formaPagamento: config?.cobra_modo === 'gratis' ? undefined : formaPagamento,
          portaoId:       precisaPortaoSaida ? portaoSaidaSel : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao registrar saída'); return }
      setSaidaAlvo(null)
      await carregarSessoes()
    } catch {
      setErro('Erro ao registrar saída. Tente novamente.')
    } finally {
      setConfirmandoSaida(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col">
      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-6">

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-white text-xl font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-outfit)' }}>
              <Car size={20} className="text-[#E8B84B]" />
              Estacionamento — {eventoTitle}
            </h1>
            {caixaNome && (
              <p className="text-[#555] text-xs mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Caixa designado: <span className="text-[#888]">{caixaNome}</span>
              </p>
            )}
          </div>
          <button type="button" onClick={() => router.back()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs shrink-0 transition-colors"
            style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', color: '#555', fontFamily: 'var(--font-dm-sans)' }}>
            <ArrowLeft size={13} /> Voltar
          </button>
        </div>

        {/* Primeiro passo ao entrar no caixa: conectar a impressora */}
        <ImpressoraBluetooth contexto={eventoTitle} />

        {estacionamentos.length === 0 && (
          <p className="text-[#555] text-sm text-center py-10">
            Nenhum estacionamento configurado ainda pra este evento.
          </p>
        )}

        {estacionamentos.length > 0 && (
          <>
            {/* Seletor de lote (só aparece se houver mais de um) */}
            {estacionamentos.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {estacionamentos.map(e => (
                  <button key={e.id} type="button" onClick={() => setEstacionamentoId(e.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                      estacionamentoId === e.id
                        ? 'bg-[#E8B84B]/10 border-[#E8B84B]/40 text-[#E8B84B]'
                        : 'border-[#222] text-[#666] hover:border-[#333]'
                    )}>
                    {e.nome}
                  </button>
                ))}
              </div>
            )}

            {/* Formulário de entrada — só pra quem tem permissão de registrar entrada */}
            {podeEntrada && (
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Registrar entrada</p>
                {vagasTotais != null && (
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: lotado ? 'rgba(248,113,113,0.12)' : 'rgba(232,184,75,0.1)',
                      color:      lotado ? '#f87171' : ACCENT,
                      fontFamily: 'var(--font-dm-sans)',
                    }}
                  >
                    {vagasOcupadas}/{vagasTotais} vagas{lotado ? ' — lotado' : ''}
                  </span>
                )}
              </div>
              {lotado && (
                <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Sem vagas disponíveis neste estacionamento. Assim que um carro sair, libera automaticamente.
                </p>
              )}
              {precisaPortaoEntrada && (
                portoesEntradaDisponiveis.length > 1 ? (
                  <select value={portaoEntradaSel} onChange={e => setPortaoEntradaSel(e.target.value)}
                    className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    <option value="">Selecione o portão de entrada</option>
                    {portoesEntradaDisponiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                ) : portoesEntradaDisponiveis.length === 1 ? (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-[#888]" style={{ background: '#111', border: '1px solid #1c1c1c', fontFamily: 'var(--font-dm-sans)' }}>
                    <DoorOpen size={12} className="text-[#E8B84B]" /> Portão: {portoesEntradaDisponiveis[0].nome}
                  </div>
                ) : (
                  <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Nenhum portão de entrada disponível pra você neste estacionamento.
                  </p>
                )
              )}
              <input type="text" placeholder="Placa *" value={placa} disabled={lotado}
                onChange={e => setPlaca(e.target.value.toUpperCase())}
                className={cn(inp, 'disabled:opacity-40')} style={{ fontFamily: 'var(--font-dm-sans)', textTransform: 'uppercase' }} />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Nome (opcional)" value={nomeCondutor} disabled={lotado}
                  onChange={e => setNomeCondutor(e.target.value)}
                  className={cn(inp, 'disabled:opacity-40')} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                <input type="tel" placeholder="Telefone (opcional)" value={telefoneCondutor} disabled={lotado}
                  onChange={e => setTelefoneCondutor(e.target.value)}
                  className={cn(inp, 'disabled:opacity-40')} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              </div>

              {/* Preço fixo cobra na entrada */}
              {precisaPagarEntrada && (
                <div className="rounded-xl p-3" style={{ background: '#111', border: '1px solid #1c1c1c' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>Preço fixo</p>
                    <p className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-outfit)' }}>
                      {formatBRL(precoEntradaFixo)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { value: 'dinheiro' as const, icon: Banknote,    label: 'Dinheiro' },
                      { value: 'pix'      as const, icon: Smartphone,  label: 'PIX'      },
                      { value: 'cartao'   as const, icon: CreditCard,  label: 'Cartão'   },
                      { value: 'cortesia' as const, icon: Gift,        label: 'Cortesia' },
                    ]).map(({ value, icon: Icon, label }) => (
                      <button key={value} type="button" onClick={() => setFormaPagamentoEntrada(value)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all',
                          formaPagamentoEntrada === value
                            ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35 text-white'
                            : 'bg-[#0d0d0d] border-[#1c1c1c] text-[#777]'
                        )}>
                        <Icon size={12} /> {label}
                      </button>
                    ))}
                  </div>
                  {precisaCaixaEntrada && !caixaId && (
                    <p className="text-red-400 text-[11px] mt-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      Nenhum caixa designado pra você — peça pro organizador abrir e designar um caixa.
                    </p>
                  )}
                </div>
              )}

              <button type="button" onClick={handleRegistrarEntrada}
                disabled={registrando || !placa.trim() || lotado || (precisaCaixaEntrada && !caixaId) || (precisaPortaoEntrada && !portaoEntradaSel)}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 flex items-center justify-center gap-2"
                style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                {registrando ? <Loader2 size={15} className="animate-spin" /> : <><Plus size={15} /> Registrar entrada</>}
              </button>
            </div>
            )}

            {/* Carros estacionados — só pra quem tem permissão de registrar saída */}
            {podeSaida && (
            <div className="flex flex-col gap-2">
              <p className="text-[#666] text-xs uppercase tracking-widest font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Carros estacionados {!carregando && `(${sessoes.length})`}
              </p>
              {carregando && <Loader2 size={18} className="animate-spin text-[#E8B84B] mx-auto my-6" />}
              {!carregando && sessoes.length === 0 && (
                <p className="text-[#444] text-sm text-center py-6">Nenhum carro estacionado no momento.</p>
              )}
              {sessoes.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-white text-sm font-semibold tracking-wide" style={{ fontFamily: 'var(--font-dm-sans)' }}>{s.placa}</p>
                    <p className="text-[#555] text-xs flex items-center gap-1 mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      <Clock size={11} /> {tempoDecorrido(s.entrada_em)}
                      {s.nome_condutor && <span className="text-[#444]"> · {s.nome_condutor}</span>}
                    </p>
                  </div>
                  <button type="button" onClick={() => abrirConfirmarSaida(s)}
                    className="px-3 py-2 rounded-lg text-xs font-medium border border-[#222] text-[#aaa] hover:border-[#E8B84B]/40 hover:text-[#E8B84B] transition-colors">
                    Registrar saída
                  </button>
                </div>
              ))}
            </div>
            )}
          </>
        )}

        {erro && !saidaAlvo && <p className="text-red-400 text-xs text-center">{erro}</p>}
      </div>

      {/* Modal de confirmação de saída */}
      {saidaAlvo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xs bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Saída — {saidaAlvo.placa}
              </p>
              <button onClick={() => setSaidaAlvo(null)} className="text-[#444] hover:text-[#777]"><X size={16} /></button>
            </div>

            <div className="text-center py-4 mb-4 rounded-xl" style={{ background: '#111' }}>
              {estacionamentos.find(e => e.id === saidaAlvo.estacionamento_id)?.cobra_modo === 'fixo' ? (
                <>
                  <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>Preço fixo</p>
                  <p className="text-white text-lg font-semibold mt-1" style={{ fontFamily: 'var(--font-outfit)' }}>
                    Já pago na entrada
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>Valor a cobrar</p>
                  <p className="text-white text-2xl font-bold mt-1" style={{ fontFamily: 'var(--font-outfit)' }}>
                    {formatBRL(valorPreview)}
                  </p>
                </>
              )}
            </div>

            {precisaPortaoSaida && (
              portoesSaidaDisponiveis.length > 1 ? (
                <select value={portaoSaidaSel} onChange={e => setPortaoSaidaSel(e.target.value)}
                  className={cn(inp, 'mb-4')} style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  <option value="">Selecione o portão de saída</option>
                  {portoesSaidaDisponiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              ) : portoesSaidaDisponiveis.length === 1 ? (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-[#888] mb-4" style={{ background: '#111', border: '1px solid #1c1c1c', fontFamily: 'var(--font-dm-sans)' }}>
                  <DoorOpen size={12} className="text-[#E8B84B]" /> Portão: {portoesSaidaDisponiveis[0].nome}
                </div>
              ) : (
                <p className="text-red-400 text-xs mb-4" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Nenhum portão de saída disponível pra você neste estacionamento.
                </p>
              )
            )}

            {valorPreview > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {([
                  { value: 'dinheiro' as const, icon: Banknote,    label: 'Dinheiro' },
                  { value: 'pix'      as const, icon: Smartphone,  label: 'PIX'      },
                  { value: 'cartao'   as const, icon: CreditCard,  label: 'Cartão'   },
                  { value: 'cortesia' as const, icon: Gift,        label: 'Cortesia' },
                ]).map(({ value, icon: Icon, label }) => (
                  <button key={value} type="button" onClick={() => setFormaPagamento(value)}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all',
                      formaPagamento === value
                        ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35 text-white'
                        : 'bg-[#111] border-[#1c1c1c] text-[#777]'
                    )}>
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
            )}

            {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

            <button type="button" onClick={handleConfirmarSaida} disabled={confirmandoSaida || (precisaPortaoSaida && !portaoSaidaSel)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 flex items-center justify-center gap-2"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
              {confirmandoSaida ? <Loader2 size={15} className="animate-spin" /> : 'Confirmar saída'}
            </button>
            <button type="button" onClick={() => setSaidaAlvo(null)}
              className="w-full text-center text-[#444] hover:text-[#777] text-xs mt-3 flex items-center justify-center gap-1.5">
              <ArrowLeft size={12} /> Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
