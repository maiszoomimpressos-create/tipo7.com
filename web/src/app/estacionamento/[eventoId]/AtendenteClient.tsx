'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Car, Plus, Loader2, Clock, Banknote, CreditCard, Smartphone, Gift, X, ArrowLeft, DoorOpen,
  Wallet, Lock, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { calcularValorEstacionamento } from '@/lib/estacionamentoPricing'
import { ImpressoraBluetooth } from '@/components/ImpressoraBluetooth'
import { PrintServerPanel } from '@/components/PrintServerPanel'
import { imprimirTicketPrintServer } from '@/lib/printServerClient'
import { gerarComandosMultiplos, imprimirViaTipPrint } from '@/lib/rawbtPrint'
import { apiFetchAuth } from '@/lib/apiFetch'

const ACCENT = '#E8B84B'

// Estacionamento hoje não imprime nada de verdade na entrada (só WhatsApp) —
// mesmas duas opções de alto nível da Bilheteria: Computador (RawBts
// PrintServer, cobre Bluetooth/USB/driver Windows sozinho) ou Celular
// (RawBT/Android). Sem 'a4' aqui, ticket de estacionamento é sempre cupom.
type FormatoImpressaoEstacionamento = 'printserver' | 'rawbt' | 'nenhuma'

const FORMATOS_IMPRESSAO_ESTACIONAMENTO: { value: FormatoImpressaoEstacionamento; label: string }[] = [
  { value: 'printserver', label: 'Computador' },
  { value: 'rawbt',        label: 'Celular' },
  { value: 'nenhuma',      label: 'Não imprimir' },
]

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

function formatCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
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
  const [modelo, setModelo] = useState('')
  const [cor, setCor] = useState('')
  const [cpfCondutor, setCpfCondutor] = useState('')
  const [buscandoPlaca, setBuscandoPlaca] = useState(false)
  const [placaAutopreenchida, setPlacaAutopreenchida] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [formaPagamentoEntrada, setFormaPagamentoEntrada] = useState<'dinheiro' | 'pix' | 'cartao' | 'cortesia'>('dinheiro')
  const [modalSemWhats, setModalSemWhats] = useState(false)
  const [portaoEntradaSel, setPortaoEntradaSel] = useState('')
  const [portaoSaidaSel,   setPortaoSaidaSel]   = useState('')
  const [modalFecharCaixa, setModalFecharCaixa] = useState(false)
  const [dinheiroContado,  setDinheiroContado]  = useState('')
  const [salvandoCaixa,    setSalvandoCaixa]    = useState(false)
  const [erroCaixa,        setErroCaixa]        = useState<string | null>(null)

  const [sessoes, setSessoes] = useState<Sessao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [, setTick] = useState(0)

  const [saidaAlvo, setSaidaAlvo] = useState<Sessao | null>(null)
  const [formaPagamento, setFormaPagamento] = useState<'dinheiro' | 'pix' | 'cartao' | 'cortesia'>('dinheiro')
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)

  // Pedido do usuário (17/08/2026): sinal visual grande no terminal do
  // caixa depois de validar o pagamento (dinheiro/PIX hoje, cartão entra
  // depois) — verde "LIBERADO" ou vermelho "ACESSO NEGADO", pra quem tá
  // olhando de longe (ex: portão/cancela) saber na hora se o carro pode
  // passar, sem precisar ler texto pequeno de erro.
  const [statusAcesso, setStatusAcesso] = useState<{ tipo: 'liberado' | 'negado'; titulo: string; detalhe: string } | null>(null)
  useEffect(() => {
    if (!statusAcesso) return
    const t = setTimeout(() => setStatusAcesso(null), statusAcesso.tipo === 'liberado' ? 3500 : 5000)
    return () => clearTimeout(t)
  }, [statusAcesso])

  // Impressão do ticket de estacionamento na entrada — mesmo padrão de
  // localStorage por evento já usado na Bilheteria (tipo7-impressora-${id}).
  const [formatoImpressao, setFormatoImpressao] = useState<FormatoImpressaoEstacionamento>('nenhuma')
  const [erroImpressao, setErroImpressao] = useState<string | null>(null)
  useEffect(() => {
    const saved = localStorage.getItem(`tipo7-impressora-estacionamento-${eventoId}`) as FormatoImpressaoEstacionamento | null
    if (saved) setFormatoImpressao(saved)
  }, [eventoId])
  function salvarFormatoImpressao(f: FormatoImpressaoEstacionamento) {
    setFormatoImpressao(f)
    localStorage.setItem(`tipo7-impressora-estacionamento-${eventoId}`, f)
  }

  const carregarSessoes = useCallback(async () => {
    const res  = await apiFetchAuth(`/api/estacionamento/${eventoId}/sessoes?status=aberto`)
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

  const handleBuscarPlaca = async () => {
    const placaLimpa = placa.trim()
    if (placaLimpa.length < 7) return
    setBuscandoPlaca(true)
    try {
      const res = await apiFetchAuth(`/api/estacionamento/placa-lookup?placa=${encodeURIComponent(placaLimpa)}`)
      const data = await res.json()
      if (data.found) {
        if (data.modelo) setModelo(data.modelo)
        if (data.cor)    setCor(data.cor)
        setPlacaAutopreenchida(true)
      }
    } catch {
      // Busca é best-effort — se falhar, atendente preenche manualmente.
    } finally {
      setBuscandoPlaca(false)
    }
  }

  const handleRegistrarEntrada = () => {
    if (!estacionamentoId || lotado) return
    if (!placa.trim() || !modelo.trim() || !cor.trim()) {
      setErro('Preencha placa, modelo e cor.')
      return
    }
    if (precisaPortaoEntrada && !portaoEntradaSel) {
      setErro('Selecione o portão de entrada.')
      return
    }
    if (precisaCaixaEntrada && !caixaId) {
      setErro('Nenhum caixa aberto designado pra você. Peça pro organizador abrir e designar um caixa.')
      return
    }
    if (!telefoneCondutor.trim()) {
      setErro(null)
      setModalSemWhats(true)
      return
    }
    executarRegistroEntrada(false)
  }

  const executarRegistroEntrada = async (semWhatsapp: boolean) => {
    setModalSemWhats(false)
    setRegistrando(true); setErro(null)
    try {
      const res = await apiFetchAuth('/api/estacionamento/entrada', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          estacionamentoId,
          placa:             placa.trim(),
          nomeCondutor:      nomeCondutor.trim()     || undefined,
          telefoneCondutor:  telefoneCondutor.trim() || undefined,
          modelo:            modelo.trim()           || undefined,
          cor:               cor.trim()              || undefined,
          cpfCondutor:       cpfCondutor.trim()       || undefined,
          // Achado real (17/08/2026): reenviar o "modelo" pra Autosave numa
          // placa que já veio do autopreenchimento duplicava a marca a cada
          // entrada repetida (ver salvarVeiculoNaAutosave). `placaAutopreenchida`
          // já rastreia exatamente isso — se veio da busca, não precisa
          // salvar de novo.
          veiculoJaCadastrado: placaAutopreenchida,
          semWhatsapp,
          formaPagamento:    precisaPagarEntrada ? formaPagamentoEntrada : undefined,
          caixaId:           precisaCaixaEntrada ? caixaId ?? undefined : undefined,
          portaoId:          precisaPortaoEntrada ? portaoEntradaSel : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error ?? 'Erro ao registrar entrada'
        setErro(msg)
        setStatusAcesso({ tipo: 'negado', titulo: 'ACESSO NEGADO', detalhe: msg })
        return
      }
      // Falha de impressão não deve travar a entrada — o carro já está
      // registrado no banco nesse ponto, o comprovante físico é só um
      // reforço (o WhatsApp, se enviado, já cobre o caso de perda do papel).
      if (data.sessaoId && formatoImpressao !== 'nenhuma') {
        imprimirTicketEstacionamento(data.sessaoId).catch(e => {
          console.error(e)
          setErroImpressao(e instanceof Error ? e.message : 'Erro ao imprimir o ticket')
        })
      }
      setStatusAcesso({ tipo: 'liberado', titulo: 'LIBERADO', detalhe: `${placa.trim().toUpperCase()} — entrada registrada` })
      setPlaca(''); setNomeCondutor(''); setTelefoneCondutor('')
      setModelo(''); setCor(''); setCpfCondutor(''); setFormaPagamentoEntrada('dinheiro')
      setPlacaAutopreenchida(false)
      await carregarSessoes()
    } catch {
      const msg = 'Erro ao registrar entrada. Tente novamente.'
      setErro(msg)
      setStatusAcesso({ tipo: 'negado', titulo: 'ACESSO NEGADO', detalhe: msg })
    } finally {
      setRegistrando(false)
    }
  }

  // Dispara a impressão do ticket de entrada — placa/modelo/cor viajam no
  // campo `sector` do PrintServer (não existe campo dedicado pra isso, ver
  // plano de integração) já que aqui não há conceito de setor de evento.
  async function imprimirTicketEstacionamento(sessaoId: string) {
    const nomeLocal = estacionamentoAtual?.nome ?? ''
    const agora = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const detalhesVeiculo = `${placa.trim().toUpperCase()} - ${modelo.trim()} ${cor.trim()}`.trim()

    if (formatoImpressao === 'printserver') {
      setErroImpressao(null)
      await imprimirTicketPrintServer({
        title:  'TICKET ESTACIONAMENTO',
        event:  eventoTitle,
        date:   agora,
        local:  nomeLocal,
        sector: detalhesVeiculo,
        buyer:  nomeCondutor.trim() || undefined,
        code:   sessaoId,
        qr:     sessaoId,
        price:  precisaPagarEntrada ? formatBRL(precoEntradaFixo) : undefined,
      })
    } else if (formatoImpressao === 'rawbt') {
      setErroImpressao(null)
      imprimirViaTipPrint(gerarComandosMultiplos([{
        slotNumber:    1,
        totalSlots:    1,
        qrToken:       sessaoId,
        eventoTitle:   'TICKET ESTACIONAMENTO',
        dataFormatada: agora,
        eventoLocal:   nomeLocal,
        ticketName:    detalhesVeiculo,
        portador:      nomeCondutor.trim() || 'Estacionamento',
      }]))
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
      const res = await apiFetchAuth('/api/estacionamento/saida', {
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
      if (!res.ok) {
        const msg = data.error ?? 'Erro ao registrar saída'
        setErro(msg)
        setStatusAcesso({ tipo: 'negado', titulo: 'ACESSO NEGADO', detalhe: msg })
        return
      }
      setStatusAcesso({ tipo: 'liberado', titulo: 'LIBERADO', detalhe: `${saidaAlvo.placa} — saída registrada` })
      setSaidaAlvo(null)
      await carregarSessoes()
    } catch {
      const msg = 'Erro ao registrar saída. Tente novamente.'
      setErro(msg)
      setStatusAcesso({ tipo: 'negado', titulo: 'ACESSO NEGADO', detalhe: msg })
    } finally {
      setConfirmandoSaida(false)
    }
  }

  const handleFecharCaixa = async () => {
    if (!caixaId) return
    setSalvandoCaixa(true); setErroCaixa(null)
    try {
      const res = await apiFetchAuth('/api/caixas/fechar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ caixaId, dinheiro_contado: Number(dinheiroContado) || 0, ingressos_devolvidos: 0 }),
      })
      const data = await res.json()
      if (!res.ok) { setErroCaixa(data.error ?? 'Erro ao fechar caixa'); return }
      setModalFecharCaixa(false); setDinheiroContado('')
      router.refresh()
    } catch {
      setErroCaixa('Erro ao fechar caixa. Tente novamente.')
    } finally {
      setSalvandoCaixa(false)
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
            {caixaNome ? (
              <button type="button" onClick={() => setModalFecharCaixa(true)}
                className="flex items-center gap-1.5 mt-1 text-xs hover:underline" style={{ color: '#888', fontFamily: 'var(--font-dm-sans)' }}>
                <Wallet size={11} className="text-green-400" /> Caixa: {caixaNome} · enviar contagem
              </button>
            ) : (
              <p className="flex items-center gap-1.5 mt-1 text-xs" style={{ color: '#555', fontFamily: 'var(--font-dm-sans)' }}>
                <Lock size={11} /> Sem caixa designado — peça pro organizador abrir um pra você
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

        {/* Impressão do ticket de entrada — mesmas 2 opções de alto nível da
            Bilheteria (Computador via PrintServer / Celular via RawBT). */}
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-[#555] text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Imprimir ticket na entrada
          </p>
          <div className="flex gap-2">
            {FORMATOS_IMPRESSAO_ESTACIONAMENTO.map(f => (
              <button key={f.value} type="button" onClick={() => salvarFormatoImpressao(f.value)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-colors"
                style={{
                  background: formatoImpressao === f.value ? `${ACCENT}15` : '#111',
                  border: `1px solid ${formatoImpressao === f.value ? ACCENT + '50' : '#222'}`,
                  color: formatoImpressao === f.value ? ACCENT : '#888',
                  fontFamily: 'var(--font-dm-sans)',
                }}>
                {f.label}
              </button>
            ))}
          </div>
          {formatoImpressao === 'printserver' && <PrintServerPanel />}
          {erroImpressao && (
            <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erroImpressao}</p>
          )}
        </div>

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
              <div className="relative">
                <input type="text" placeholder="Placa *" value={placa} disabled={lotado}
                  onChange={e => { setPlaca(e.target.value.toUpperCase()); setPlacaAutopreenchida(false) }}
                  onBlur={handleBuscarPlaca}
                  className={cn(inp, 'disabled:opacity-40')} style={{ fontFamily: 'var(--font-dm-sans)', textTransform: 'uppercase' }} />
                {buscandoPlaca && (
                  <Loader2 size={14} className="animate-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-[#555]" />
                )}
              </div>
              {placaAutopreenchida && (
                <p className="text-[10px] -mt-1 flex items-center gap-1" style={{ color: '#4ade80', fontFamily: 'var(--font-dm-sans)' }}>
                  Modelo e cor preenchidos automaticamente — confira antes de registrar.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Modelo *" value={modelo} disabled={lotado}
                  onChange={e => setModelo(e.target.value)}
                  className={cn(inp, 'disabled:opacity-40')} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                <input type="text" placeholder="Cor *" value={cor} disabled={lotado}
                  onChange={e => setCor(e.target.value)}
                  className={cn(inp, 'disabled:opacity-40')} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Nome (opcional)" value={nomeCondutor} disabled={lotado}
                  onChange={e => setNomeCondutor(e.target.value)}
                  className={cn(inp, 'disabled:opacity-40')} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                <input type="tel" placeholder="WhatsApp (envio do ticket) *" value={telefoneCondutor} disabled={lotado}
                  onChange={e => setTelefoneCondutor(e.target.value)}
                  className={cn(inp, 'disabled:opacity-40')} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              </div>
              <input type="text" placeholder="CPF do condutor (opcional)" value={cpfCondutor} disabled={lotado}
                inputMode="numeric" maxLength={14}
                onChange={e => setCpfCondutor(formatCPF(e.target.value))}
                className={cn(inp, 'disabled:opacity-40')} style={{ fontFamily: 'var(--font-dm-sans)' }} />

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
                disabled={registrando || !placa.trim() || !modelo.trim() || !cor.trim() || lotado || (precisaCaixaEntrada && !caixaId) || (precisaPortaoEntrada && !portaoEntradaSel)}
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

      {/* Modal — enviar contagem do caixa (o organizador valida depois, confere o troco na entrega) */}
      {modalFecharCaixa && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xs bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Enviar contagem — {caixaNome}</p>
              <button onClick={() => setModalFecharCaixa(false)} className="text-[#444] hover:text-[#777]"><X size={16} /></button>
            </div>
            <div className="flex flex-col gap-3 mb-4">
              <input type="number" placeholder="Dinheiro contado na gaveta (R$)" value={dinheiroContado}
                onChange={e => setDinheiroContado(e.target.value)} min="0" step="0.01"
                className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} autoFocus />
              <p className="text-[#444] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Isso não fecha o caixa ainda — o organizador precisa validar a contagem quando você entregar o dinheiro.
              </p>
            </div>
            {erroCaixa && <p className="text-red-400 text-xs text-center mb-3">{erroCaixa}</p>}
            <button type="button" onClick={handleFecharCaixa} disabled={salvandoCaixa}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 flex items-center justify-center gap-2"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
              {salvandoCaixa ? <Loader2 size={15} className="animate-spin" /> : 'Enviar contagem'}
            </button>
          </div>
        </div>
      )}

      {/* Modal — confirmação de entrada sem WhatsApp do condutor */}
      {modalSemWhats && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xs bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-6">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <p className="text-white text-sm font-semibold mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Registrar sem WhatsApp?
            </p>
            <p className="text-[#888] text-xs leading-relaxed mb-5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Sem o WhatsApp, o único comprovante do veículo será o ticket impresso na hora.
              Se o cliente perder esse ticket, o carro pode ficar retido até confirmação do organizador.
              Tem certeza que quer continuar sem o WhatsApp do condutor?
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => executarRegistroEntrada(true)} disabled={registrando}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 flex items-center justify-center gap-2"
                style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                {registrando ? <Loader2 size={15} className="animate-spin" /> : 'Continuar sem WhatsApp'}
              </button>
              <button type="button" onClick={() => setModalSemWhats(false)}
                className="w-full text-center text-[#666] hover:text-[#999] text-xs py-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Voltar e preencher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sinal grande de liberado/negado — some sozinho, ou toque pra
          fechar antes. z-[200] pra ficar acima até dos outros modais. */}
      {statusAcesso && (
        <div
          onClick={() => setStatusAcesso(null)}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 px-6 cursor-pointer"
          style={{
            background: statusAcesso.tipo === 'liberado' ? 'rgba(22,163,74,0.97)' : 'rgba(220,38,38,0.97)',
          }}
        >
          {statusAcesso.tipo === 'liberado'
            ? <CheckCircle2 size={96} className="text-white" strokeWidth={1.5} />
            : <XCircle size={96} className="text-white" strokeWidth={1.5} />}
          <p className="text-white text-4xl font-bold tracking-wide text-center" style={{ fontFamily: 'var(--font-outfit)' }}>
            {statusAcesso.titulo}
          </p>
          <p className="text-white/90 text-base text-center max-w-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {statusAcesso.detalhe}
          </p>
          <p className="text-white/60 text-xs mt-4" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Toque pra fechar
          </p>
        </div>
      )}
    </div>
  )
}
