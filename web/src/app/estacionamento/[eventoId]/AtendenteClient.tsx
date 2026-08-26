'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Car, Plus, Loader2, Clock, Banknote, CreditCard, Smartphone, Gift, X, ArrowLeft, DoorOpen,
  Wallet, Lock, AlertTriangle, CheckCircle2, XCircle, MinusCircle, Search,
  ChevronDown, ChevronUp, Bluetooth, Calculator,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { calcularValorEstacionamento } from '@/lib/estacionamentoPricing'
import { ImpressoraBluetooth } from '@/components/ImpressoraBluetooth'
import { PrintServerPanel } from '@/components/PrintServerPanel'
import { imprimirTicketPrintServer } from '@/lib/printServerClient'
import { gerarComandosMultiplos, imprimirViaTipPrint } from '@/lib/rawbtPrint'
import { apiFetchAuth } from '@/lib/apiFetch'
import { ModalSangria } from '@/components/ModalSangria'

const ACCENT = '#E8B84B'

type FormaPagamento = 'dinheiro' | 'pix' | 'cartao' | 'cortesia'

// Extraído (25/08/2026) — antes vivia duplicado, literal, dentro do JSX de
// entrada e de saída. Agora é a fonte única, usada tanto pelo botão-resumo
// quanto pelo modal de escolha.
const FORMAS_PAGAMENTO: { value: FormaPagamento; icon: React.ElementType; label: string }[] = [
  { value: 'dinheiro', icon: Banknote,   label: 'Dinheiro' },
  { value: 'pix',      icon: Smartphone, label: 'PIX'      },
  { value: 'cartao',   icon: CreditCard, label: 'Cartão'   },
  { value: 'cortesia', icon: Gift,       label: 'Cortesia' },
]

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
  // Achado real (19/08/2026, dado real perdido em produção): separado de
  // `placaAutopreenchida` de propósito. Autopreencher (achou dado) não é a
  // mesma coisa que já estar cadastrado na Autosave -- desde o fallback pra
  // APIBrasil, uma placa nunca vista antes também autopreenche, mas não é
  // veículo cadastrado ainda. Usar `placaAutopreenchida` aqui fazia a
  // entrada "pular" o POST que criaria o veículo, e ele nunca aparecia na
  // Autosave mesmo depois de "Registrar entrada".
  const [veiculoJaCadastrado, setVeiculoJaCadastrado] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Pedido do usuário (25/08/2026): "Dinheiro" vinha marcado por padrão
  // sem ninguém ter clicado — parecia escolha automática. Agora começa
  // sem nada selecionado, e os 4 botões soltos viraram 1 botão-resumo que
  // abre um modal de escolha (ver ModalSelecionarPagamento no fim do
  // arquivo) — menos poluição visual, e nada aparece "já escolhido".
  const [formaPagamentoEntrada, setFormaPagamentoEntrada] = useState<FormaPagamento | null>(null)
  const [selecionandoPagEntrada, setSelecionandoPagEntrada] = useState(false)
  const [modalSemWhats, setModalSemWhats] = useState(false)
  // Pedido do usuário (25/08/2026): pagar em dinheiro era só marcar o
  // botão "Dinheiro" — sem nenhum apoio pra calcular o troco. Agora, ao
  // escolher Dinheiro, abre um mini-PDV: digita quanto o cliente entregou,
  // o sistema já mostra o troco, confirma e só aí marca a forma de
  // pagamento. Compartilhado entre entrada e saída (guarda o preço e o
  // callback de quem chamou).
  const [trocoAberto, setTrocoAberto] = useState<{ preco: number; onConfirmar: () => void } | null>(null)
  const [portaoEntradaSel, setPortaoEntradaSel] = useState('')
  const [portaoSaidaSel,   setPortaoSaidaSel]   = useState('')
  const [modalFecharCaixa, setModalFecharCaixa] = useState(false)
  // Sangria (20/08/2026) — ver project_token_pin_acesso_caixa na memória.
  // Especialmente útil aqui: estacionamento normalmente não tem gaveta
  // fixa (atendente anda pelo pátio com o dinheiro), então sangrar antes de
  // trocar de posto/função é o jeito combinado de manter o rastro contábil.
  const [modalSangria, setModalSangria] = useState(false)
  const [dinheiroContado,  setDinheiroContado]  = useState('')
  const [salvandoCaixa,    setSalvandoCaixa]    = useState(false)
  const [erroCaixa,        setErroCaixa]        = useState<string | null>(null)

  const [sessoes, setSessoes] = useState<Sessao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [, setTick] = useState(0)

  const [saidaAlvo, setSaidaAlvo] = useState<Sessao | null>(null)
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>(null)
  const [selecionandoPagSaida, setSelecionandoPagSaida] = useState(false)
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)

  // Busca por placa na saída (22/08/2026, pedido do usuário) — mesmo padrão
  // de UX que já existe pra entrada (campo "Placa *" com autofoco): digitar
  // acha o carro na hora em vez de rolar a lista "Carros estacionados"
  // procurando visualmente. Achando exatamente 1 correspondência com 3+
  // caracteres, já abre a confirmação de saída sozinho — mesmo fluxo que a
  // lista já fazia ao clicar, só que sem precisar rolar/clicar.
  const [buscaSaida, setBuscaSaida] = useState('')

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

  // Pedido do usuário (25/08/2026): a configuração de impressora/ticket
  // ficava sempre aberta, ocupando a tela toda vez — quem já configurou
  // isso não precisa ver de novo a cada entrada. Escondida por padrão,
  // com um botão pra reabrir quando precisar mexer.
  const [configImpressaoAberta, setConfigImpressaoAberta] = useState(false)

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
  // Era 20s; reduzido pra 8s (pedido do usuário, 25/08/2026, testando com 2
  // caixas ao mesmo tempo) — só afeta o que aparece na tela, a checagem de
  // vaga/placa duplicada já é atômica no banco (registrar_entrada_
  // estacionamento), então não há risco de segurança em deixar mais rápido.
  useEffect(() => {
    const id = setInterval(() => { carregarSessoes() }, 8_000)
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

  // Achado real (19/08/2026): o backend já bloqueia entrada duplicada da
  // mesma placa no mesmo evento (ver registrar_entrada_estacionamento), mas
  // só avisa o atendente quando ele aperta "Registrar entrada" — tarde
  // demais, depois de já ter preenchido tudo. `sessoes` já traz TODAS as
  // sessões abertas do evento (todos os estacionamentos, não só o
  // selecionado — mesmo escopo do bloqueio no banco), então dá pra avisar
  // assim que a placa bate com uma sessão aberta, sem round-trip extra.
  const placaJaDentro = useMemo(() => {
    const alvo = placa.trim().toUpperCase()
    if (alvo.length !== 7) return null
    return sessoes.find(s => s.placa.toUpperCase() === alvo) ?? null
  }, [placa, sessoes])

  // Aviso flutuante da placa duplicada — cobre por cima os campos já
  // preenchidos (não só ocupa espaço vazio embaixo do input). Fechar (X ou
  // clique fora) já limpa os dados digitados, pedido do usuário
  // (19/08/2026) pra não deixar lixo de uma tentativa barrada no
  // formulário. Limpar a placa já derruba `placaJaDentro` sozinho (some
  // menos que 7 caracteres), então não precisa de um segundo estado de
  // "fechado".
  const avisoPlacaRef = useRef<HTMLDivElement>(null)
  // Achado real (19/08/2026): limpar os campos não cancelava a busca de
  // placa em andamento — se a resposta da Autosave chegasse DEPOIS do
  // clique em "Limpar", ela reaplicava modelo/cor da placa antiga por
  // cima dos campos recém-zerados. `placaAtualRef` espelha `placa` em
  // tempo real (sem esperar o próximo render) pra handleBuscarPlaca
  // conferir, quando a resposta chega, se ainda é a placa que o
  // atendente está vendo — se não for, descarta o resultado.
  const placaAtualRef = useRef('')
  useEffect(() => { placaAtualRef.current = placa }, [placa])
  const limparCamposPlaca = useCallback(() => {
    setPlaca(''); setModelo(''); setCor('')
    setNomeCondutor(''); setTelefoneCondutor(''); setCpfCondutor('')
    setPlacaAutopreenchida(false); setVeiculoJaCadastrado(false)
    placaAtualRef.current = ''
  }, [])
  useEffect(() => {
    if (!placaJaDentro) return
    function onClickFora(e: MouseEvent) {
      if (avisoPlacaRef.current && !avisoPlacaRef.current.contains(e.target as Node)) {
        limparCamposPlaca()
      }
    }
    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [placaJaDentro, limparCamposPlaca])

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

  // Achado real (18/08/2026, pedido do dono): antes só buscava no onBlur —
  // ou seja, só depois do atendente tirar o foco do campo, um passo a mais e
  // um delay evitável. Agora o onChange chama isso já passando o valor novo
  // direto (aceita `valorPlaca` em vez de ler `placa` do estado, que ainda
  // não foi commitado nesse mesmo ciclo de render — closure velha clássica).
  // onBlur continua de reforço (cobre paste/autofill que não passa aqui).
  const handleBuscarPlaca = async (valorPlaca?: string) => {
    const placaLimpa = (valorPlaca ?? placa).trim()
    if (placaLimpa.length !== 7) return
    setBuscandoPlaca(true)
    try {
      const res = await apiFetchAuth(`/api/estacionamento/placa-lookup?placa=${encodeURIComponent(placaLimpa)}`)
      const data = await res.json()
      // Descarta se o atendente já trocou/limpou a placa enquanto a busca
      // estava em andamento — evita reaplicar modelo/cor de uma placa que
      // não é mais a que está na tela (ver comentário em placaAtualRef).
      if (placaAtualRef.current.trim().toUpperCase() !== placaLimpa) return
      if (data.found) {
        if (data.modelo) setModelo(data.modelo)
        if (data.cor)    setCor(data.cor)
        setPlacaAutopreenchida(true)
        setVeiculoJaCadastrado(data.jaCadastrado === true)
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
          // entrada repetida (ver salvarVeiculoNaAutosave).
          // Achado real (19/08/2026): `placaAutopreenchida` só diz "achamos
          // dado pra essa placa" — não diz se ela já é um veículo cadastrado
          // de verdade (desde o fallback pra APIBrasil, placa nunca vista
          // também autopreenche). Usar `veiculoJaCadastrado` (confirmado pela
          // própria Autosave) é o que garante que uma placa nova de fato
          // recebe o POST que cria o veículo, mesmo já vindo autopreenchida.
          veiculoJaCadastrado,
          semWhatsapp,
          formaPagamento:    precisaPagarEntrada ? (formaPagamentoEntrada ?? undefined) : undefined,
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
      setVeiculoJaCadastrado(false)
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

  const fecharConfirmarSaida = () => {
    setSaidaAlvo(null)
    setBuscaSaida('')
  }

  // Filtra "Carros estacionados" pela busca — placa não precisa bater
  // exata, só conter o que foi digitado (facilita achar mesmo lembrando só
  // parte da placa).
  const sessoesFiltradas = useMemo(() => {
    const q = buscaSaida.trim().toUpperCase()
    if (!q) return sessoes
    return sessoes.filter(s => s.placa.toUpperCase().includes(q))
  }, [sessoes, buscaSaida])

  // Achou exatamente 1 carro com a busca (3+ caracteres, pra não abrir sozinho
  // digitando a 1ª letra) — abre a confirmação direto, sem precisar clicar
  // na lista. Só dispara se não tiver outra sessão já aberta na tela.
  useEffect(() => {
    const q = buscaSaida.trim()
    if (q.length >= 3 && sessoesFiltradas.length === 1 && !saidaAlvo) {
      abrirConfirmarSaida(sessoesFiltradas[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaSaida, sessoesFiltradas])

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
          formaPagamento: config?.cobra_modo === 'gratis' ? undefined : (formaPagamento ?? undefined),
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
      fecharConfirmarSaida()
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
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <button type="button" onClick={() => setModalFecharCaixa(true)}
                  className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: '#888', fontFamily: 'var(--font-dm-sans)' }}>
                  <Wallet size={11} className="text-green-400" /> Caixa: {caixaNome} · enviar contagem
                </button>
                <button type="button" onClick={() => setModalSangria(true)}
                  className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: '#666', fontFamily: 'var(--font-dm-sans)' }}>
                  <MinusCircle size={11} className="text-red-400/70" /> Sangrar
                </button>
              </div>
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

        {/* Config de impressora/ticket — escondida por padrão (pedido do
            usuário, 25/08/2026), quem já configurou não precisa ver de
            novo toda hora que entra na tela. */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
          <button type="button" onClick={() => setConfigImpressaoAberta(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 transition-colors"
            style={{ background: '#0d0d0d' }}>
            <span className="flex items-center gap-2 text-[#888] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <Bluetooth size={13} /> Impressora e ticket de entrada
            </span>
            {configImpressaoAberta ? <ChevronUp size={14} className="text-[#555]" /> : <ChevronDown size={14} className="text-[#555]" />}
          </button>

          {configImpressaoAberta && (
            <div className="px-4 pb-4 pt-1 flex flex-col gap-4" style={{ borderTop: '1px solid #1a1a1a', background: '#0a0a0a' }}>
              {/* Primeiro passo ao entrar no caixa: conectar a impressora */}
              <ImpressoraBluetooth contexto={eventoTitle} />

              {/* Impressão do ticket de entrada — mesmas 2 opções de alto nível
                  da Bilheteria (Computador via PrintServer / Celular via RawBT). */}
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
            </div>
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
                  onChange={e => {
                    const next = e.target.value.toUpperCase()
                    setPlaca(next)
                    setPlacaAutopreenchida(false)
                    setVeiculoJaCadastrado(false)
                    // Dispara assim que a 7ª letra/número é digitado — não
                    // espera o atendente tirar o foco do campo.
                    if (next.trim().length === 7) void handleBuscarPlaca(next)
                  }}
                  onBlur={() => handleBuscarPlaca()}
                  className={cn(inp, 'disabled:opacity-40')} style={{ fontFamily: 'var(--font-dm-sans)', textTransform: 'uppercase' }} />
                {buscandoPlaca && (
                  <Loader2 size={14} className="animate-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-[#555]" />
                )}
              </div>

              {/* Resto do formulário — vira o "fundo" desfocado quando o
                  aviso de placa duplicada cobre tudo por cima. */}
              <div className="relative">
                <div className={cn(
                  'flex flex-col gap-3 transition-all duration-150',
                  placaJaDentro && 'blur-[3px] opacity-30 pointer-events-none select-none'
                )}>
                  {placaAutopreenchida && !placaJaDentro && (
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
                      <button type="button" onClick={() => setSelecionandoPagEntrada(true)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-xs font-medium transition-all"
                        style={{
                          background:  formaPagamentoEntrada ? `${ACCENT}0f` : '#0d0d0d',
                          borderColor: formaPagamentoEntrada ? `${ACCENT}45` : '#1c1c1c',
                          color:       formaPagamentoEntrada ? '#fff' : '#666',
                        }}>
                        <span className="flex items-center gap-1.5">
                          {formaPagamentoEntrada ? (() => {
                            const f = FORMAS_PAGAMENTO.find(x => x.value === formaPagamentoEntrada)!
                            const Icon = f.icon
                            return <><Icon size={13} style={{ color: ACCENT }} /> {f.label}</>
                          })() : 'Selecionar forma de pagamento'}
                        </span>
                        <ChevronDown size={13} className="text-[#555]" />
                      </button>
                      {precisaCaixaEntrada && !caixaId && (
                        <p className="text-red-400 text-[11px] mt-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          Nenhum caixa designado pra você — peça pro organizador abrir e designar um caixa.
                        </p>
                      )}
                    </div>
                  )}

                  <button type="button" onClick={handleRegistrarEntrada}
                    disabled={registrando || !placa.trim() || !modelo.trim() || !cor.trim() || lotado || !!placaJaDentro || (precisaCaixaEntrada && !caixaId) || (precisaPortaoEntrada && !portaoEntradaSel) || (precisaPagarEntrada && !formaPagamentoEntrada)}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 flex items-center justify-center gap-2"
                    style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                    {registrando ? <Loader2 size={15} className="animate-spin" /> : <><Plus size={15} /> Registrar entrada</>}
                  </button>
                </div>

                {placaJaDentro && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center p-3">
                    <div ref={avisoPlacaRef}
                      className="w-full max-w-[240px] flex flex-col items-center text-center rounded-xl p-4 shadow-2xl"
                      style={{ background: '#1a0d0d', border: '1px solid rgba(248,113,113,0.45)', boxShadow: '0 12px 32px rgba(0,0,0,0.6)' }}>
                      <button type="button" onClick={limparCamposPlaca}
                        className="self-end text-red-400/50 hover:text-red-400 -mt-1.5 -mr-1.5 mb-1">
                        <X size={15} />
                      </button>
                      <p className="text-red-400 text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        Esta placa já está dentro do estacionamento
                      </p>
                      <p className="text-red-400/70 text-xs mt-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {placaJaDentro.estacionamentos?.nome ?? 'Estacionamento'} — entrada às{' '}
                        {new Date(placaJaDentro.entrada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
                        {' '}Registre a saída antes de uma nova entrada.
                      </p>
                      <button type="button" onClick={limparCamposPlaca}
                        className="mt-3 w-full py-2 rounded-lg text-xs font-semibold text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        Limpar e tentar outra placa
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Carros estacionados — só pra quem tem permissão de registrar saída */}
            {podeSaida && (
            <div className="flex flex-col gap-2">
              <p className="text-[#666] text-xs uppercase tracking-widest font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Carros estacionados {!carregando && `(${sessoes.length})`}
              </p>

              {/* Busca por placa (22/08/2026) — mesmo campo/estilo da placa
                  de entrada (`inp`), achando 1 resultado já abre a
                  confirmação de saída sozinho (ver useEffect acima). */}
              {!carregando && sessoes.length > 0 && (
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#444]" />
                  <input
                    type="text"
                    placeholder="Buscar por placa"
                    value={buscaSaida}
                    onChange={e => setBuscaSaida(e.target.value.toUpperCase())}
                    className={cn(inp, 'pl-9')}
                    style={{ fontFamily: 'var(--font-dm-sans)', textTransform: 'uppercase' }}
                  />
                </div>
              )}

              {carregando && <Loader2 size={18} className="animate-spin text-[#E8B84B] mx-auto my-6" />}
              {!carregando && sessoes.length === 0 && (
                <p className="text-[#444] text-sm text-center py-6">Nenhum carro estacionado no momento.</p>
              )}
              {!carregando && sessoes.length > 0 && sessoesFiltradas.length === 0 && (
                <p className="text-[#444] text-sm text-center py-4">Nenhum carro com essa placa.</p>
              )}
              {sessoesFiltradas.map(s => (
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
              <button onClick={fecharConfirmarSaida} className="text-[#444] hover:text-[#777]"><X size={16} /></button>
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
              <button type="button" onClick={() => setSelecionandoPagSaida(true)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-xs font-medium transition-all mb-4"
                style={{
                  background:  formaPagamento ? `${ACCENT}0f` : '#111',
                  borderColor: formaPagamento ? `${ACCENT}45` : '#1c1c1c',
                  color:       formaPagamento ? '#fff' : '#666',
                }}>
                <span className="flex items-center gap-1.5">
                  {formaPagamento ? (() => {
                    const f = FORMAS_PAGAMENTO.find(x => x.value === formaPagamento)!
                    const Icon = f.icon
                    return <><Icon size={13} style={{ color: ACCENT }} /> {f.label}</>
                  })() : 'Selecionar forma de pagamento'}
                </span>
                <ChevronDown size={13} className="text-[#555]" />
              </button>
            )}

            {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

            <button type="button" onClick={handleConfirmarSaida}
              disabled={confirmandoSaida || (precisaPortaoSaida && !portaoSaidaSel) || (valorPreview > 0 && !formaPagamento)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 flex items-center justify-center gap-2"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
              {confirmandoSaida ? <Loader2 size={15} className="animate-spin" /> : 'Confirmar saída'}
            </button>
            <button type="button" onClick={fecharConfirmarSaida}
              className="w-full text-center text-[#444] hover:text-[#777] text-xs mt-3 flex items-center justify-center gap-1.5">
              <ArrowLeft size={12} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal — enviar contagem do caixa (o organizador valida depois, confere o troco na entrega) */}
      {modalSangria && caixaId && (
        <ModalSangria caixaId={caixaId} onFechar={() => setModalSangria(false)} onSangrada={() => {}} />
      )}

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

      {trocoAberto && (
        <ModalTrocoDinheiro
          preco={trocoAberto.preco}
          onConfirmar={() => { trocoAberto.onConfirmar(); setTrocoAberto(null) }}
          onFechar={() => setTrocoAberto(null)}
        />
      )}

      {selecionandoPagEntrada && (
        <ModalSelecionarPagamento
          selecionado={formaPagamentoEntrada}
          onSelecionar={value => {
            setSelecionandoPagEntrada(false)
            if (value === 'dinheiro') {
              setTrocoAberto({ preco: precoEntradaFixo, onConfirmar: () => setFormaPagamentoEntrada('dinheiro') })
            } else {
              setFormaPagamentoEntrada(value)
            }
          }}
          onFechar={() => setSelecionandoPagEntrada(false)}
        />
      )}

      {selecionandoPagSaida && (
        <ModalSelecionarPagamento
          selecionado={formaPagamento}
          onSelecionar={value => {
            setSelecionandoPagSaida(false)
            if (value === 'dinheiro') {
              setTrocoAberto({ preco: valorPreview, onConfirmar: () => setFormaPagamento('dinheiro') })
            } else {
              setFormaPagamento(value)
            }
          }}
          onFechar={() => setSelecionandoPagSaida(false)}
        />
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

// Modal de escolha da forma de pagamento — pedido do usuário (25/08/2026):
// os 4 botões (Dinheiro/PIX/Cartão/Cortesia) ficavam soltos na tela o tempo
// todo, e "Dinheiro" vinha marcado por padrão sem ninguém ter clicado,
// parecendo escolha automática. Agora é 1 botão-resumo que abre isto aqui;
// nada aparece pré-selecionado até a pessoa escolher de propósito.
function ModalSelecionarPagamento({ selecionado, onSelecionar, onFechar }: {
  selecionado: FormaPagamento | null
  onSelecionar: (v: FormaPagamento) => void
  onFechar: () => void
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onFechar}>
      <div className="w-full max-w-xs bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Forma de pagamento</p>
          <button onClick={onFechar} className="text-[#444] hover:text-[#777]"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {FORMAS_PAGAMENTO.map(({ value, icon: Icon, label }) => (
            <button key={value} type="button" onClick={() => onSelecionar(value)}
              className={cn(
                'flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all',
                selecionado === value
                  ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35 text-white'
                  : 'bg-[#111] border-[#1c1c1c] text-[#777]'
              )}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Mini-PDV pra pagamento em dinheiro — pedido do usuário (25/08/2026): antes
// "Dinheiro" era só um botão de marcar a forma de pagamento, sem apoiar em
// nada na hora de dar troco. Digita quanto o cliente entregou, o sistema já
// calcula o troco, confirma e só aí marca a forma de pagamento como
// dinheiro (cancelar não muda nada). Puramente um apoio operacional pro
// atendente — não manda nada pro backend além da forma de pagamento em si,
// que já era gravada antes.
function ModalTrocoDinheiro({ preco, onConfirmar, onFechar }: {
  preco: number
  onConfirmar: () => void
  onFechar: () => void
}) {
  const [valorRecebido, setValorRecebido] = useState('')
  const recebido = parseFloat(valorRecebido.replace(',', '.')) || 0
  const troco = recebido - preco
  const suficiente = recebido >= preco

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onFechar}>
      <div className="w-full max-w-xs bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-white text-sm font-medium flex items-center gap-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <Calculator size={14} style={{ color: ACCENT }} /> Pagamento em dinheiro
          </p>
          <button onClick={onFechar} className="text-[#444] hover:text-[#777]"><X size={16} /></button>
        </div>

        <div className="flex items-center justify-between mb-4 px-3 py-2.5 rounded-xl" style={{ background: '#111', border: '1px solid #1c1c1c' }}>
          <span className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>Valor a cobrar</span>
          <span className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-outfit)' }}>{formatBRL(preco)}</span>
        </div>

        <label className="text-[#555] text-[10px] uppercase tracking-wider block mb-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Cliente entregou
        </label>
        <input
          type="number" inputMode="decimal" placeholder="R$ 0,00" value={valorRecebido}
          onChange={e => setValorRecebido(e.target.value)} min="0" step="0.01" autoFocus
          className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-base outline-none focus:border-[#E8B84B]/40 mb-4"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        />

        <div className="flex items-center justify-between mb-5 px-3 py-2.5 rounded-xl"
          style={{ background: troco > 0 ? '#4ade8010' : '#111', border: `1px solid ${troco > 0 ? '#4ade8030' : '#1c1c1c'}` }}>
          <span className="text-[#888] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>Troco</span>
          <span className="text-sm font-bold" style={{ color: troco > 0 ? '#4ade80' : '#555', fontFamily: 'var(--font-outfit)' }}>
            {formatBRL(Math.max(0, troco))}
          </span>
        </div>

        {valorRecebido && !suficiente && (
          <p className="text-red-400 text-xs text-center mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Valor entregue é menor que o preço.
          </p>
        )}

        <button type="button" onClick={onConfirmar} disabled={!suficiente}
          className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          Confirmar pagamento
        </button>
      </div>
    </div>
  )
}
