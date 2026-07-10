'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient as createSupabase } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  Ticket, User, Phone, CreditCard, Calendar, Printer, ChevronDown,
  Loader2, Check, AlertTriangle, ShoppingBag, ArrowLeft, Banknote,
  Smartphone, CreditCard as CardIcon, ChevronUp, Copy, CheckCircle2,
  Clock, Monitor, Settings, Download, FileText, Thermometer, MonitorOff,
} from 'lucide-react'
import QRCode from 'react-qr-code'

const ACCENT = '#E8B84B'

type MetodoPagamento = 'dinheiro' | 'pix' | 'cartao'
type Etapa = 'venda' | 'pix' | 'dados' | 'impressao'
type PrintFormat = 'a4' | 'termica80' | 'nenhuma'
type QzStatus = 'idle' | 'conectando' | 'conectado' | 'indisponivel'

const PRINT_FORMATS: { value: PrintFormat; label: string; sub: string; Icon: React.ElementType }[] = [
  { value: 'a4',       label: 'A4',          sub: 'Impressora comum',    Icon: FileText    },
  { value: 'termica80', label: 'Térmica 80mm', sub: 'Impressora de cupom', Icon: Thermometer },
  { value: 'nenhuma',  label: 'Sem impressão', sub: 'Somente tela',       Icon: MonitorOff  },
]

interface Ingresso {
  id:         string
  name:       string
  price:      number
  disponivel: number
}

interface TicketGerado {
  id:          string
  slot_number: number
  qr_token:    string
}

interface PixData {
  orderId:      string
  qrCode:       string | null
  qrCodeBase64: string | null
  total:        number
  expiresAt:    string | null
}

interface Props {
  eventoId:     string
  eventoTitle:  string
  eventoDate:   string | null
  eventoLocal:  string
  ingressos:    Ingresso[]
  operadorName: string
}

const METODOS: { value: MetodoPagamento; label: string; Icon: React.ElementType }[] = [
  { value: 'dinheiro', label: 'Dinheiro', Icon: Banknote    },
  { value: 'pix',      label: 'PIX',      Icon: Smartphone  },
  { value: 'cartao',   label: 'Cartão',   Icon: CardIcon    },
]

const QTDS_RAPIDAS = [1, 2, 3, 4, 5]

export function BilheteiroClient({ eventoId, eventoTitle, eventoDate, eventoLocal, ingressos, operadorName }: Props) {
  const [etapa,             setEtapa]             = useState<Etapa>('venda')
  const [ticketId,          setTicketId]          = useState(ingressos[0]?.id ?? '')
  const [dropdownAberto,    setDropdownAberto]    = useState(false)
  const [quantidade,        setQuantidade]        = useState(1)
  const [metodo,            setMetodo]            = useState<MetodoPagamento>('dinheiro')
  const [nome,              setNome]              = useState('')
  const [cpf,               setCpf]              = useState('')
  const [telefone,          setTelefone]          = useState('')
  const [nascimento,        setNascimento]        = useState('')
  const [dadosAbertos,      setDadosAbertos]      = useState(false)
  const [salvando,          setSalvando]          = useState(false)
  const [salvandoDados,     setSalvandoDados]     = useState(false)
  const [confirmando,       setConfirmando]       = useState(false)
  const [err,               setErr]               = useState<string | null>(null)
  const [resultado,         setResultado]         = useState<{ tickets: TicketGerado[]; ticketName: string } | null>(null)
  const [pendingTickets,    setPendingTickets]    = useState<{ tickets: TicketGerado[]; ticketName: string } | null>(null)
  const [pixData,           setPixData]           = useState<PixData | null>(null)
  const [copiado,           setCopiado]           = useState(false)
  const [tempoRestante,     setTempoRestante]     = useState<number | null>(null)
  const printRef         = useRef<HTMLDivElement>(null)
  const dropdownRef      = useRef<HTMLDivElement>(null)
  const pollingRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const realtimeRef      = useRef<RealtimeChannel | null>(null)
  const segundaRef       = useRef<Window | null>(null)
  const pixBroadcastRef  = useRef<object | null>(null)   // último payload PIX enviado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qzRef            = useRef<any>(null)

  const [qzStatus, setQzStatus] = useState<QzStatus>('idle')

  const [formato,      setFormato]      = useState<PrintFormat | null>(null)
  const [setupAberto,  setSetupAberto]  = useState(false)
  const [formatoSel,   setFormatoSel]   = useState<PrintFormat>('a4')

  const ingressoSelecionado = ingressos.find(i => i.id === ticketId)

  // Lê formato salvo ao montar
  useEffect(() => {
    const saved = localStorage.getItem(`tipo7-impressora-${eventoId}`) as PrintFormat | null
    if (saved) { setFormato(saved); setFormatoSel(saved) }
  }, [eventoId])

  // Injeta CSS de impressão dinamicamente conforme o formato escolhido
  useEffect(() => {
    const prev = document.getElementById('tipo7-print-css')
    if (prev) prev.remove()
    if (!formato || formato === 'nenhuma') return
    const s = document.createElement('style')
    s.id = 'tipo7-print-css'
    if (formato === 'termica80') {
      s.textContent = `
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { background: #fff !important; }
          .ingresso-print {
            width: 76mm !important; padding: 4mm 3mm !important;
            border: none !important; border-radius: 0 !important;
            background: #fff !important; color: #000 !important;
            page-break-after: always; break-after: page;
            box-shadow: none !important;
          }
          .ingresso-print * { color: #000 !important; }
          .ingresso-print svg rect { fill: #000 !important; }
        }
      `
    } else {
      s.textContent = `
        @media print {
          @page { size: A4; margin: 15mm; }
          body { background: #fff !important; }
          .ingresso-print {
            background: #fff !important; color: #000 !important;
            border: 1px solid #ccc !important;
            page-break-after: always; break-after: page;
            box-shadow: none !important;
          }
          .ingresso-print * { color: #000 !important; }
        }
      `
    }
    document.head.appendChild(s)
    return () => { document.getElementById('tipo7-print-css')?.remove() }
  }, [formato])

  // Carrega QZ Tray (Java bridge para impressão silenciosa) e tenta conectar
  useEffect(() => {
    function conectar() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const qz = (window as any).qz
      if (!qz) return
      // Permite conexão não-assinada — o usuário deve ativar "Allow unsigned" no QZ Tray
      qz.security.setCertificatePromise((resolve: (v: string) => void) => resolve(''))
      qz.security.setSignaturePromise(() => (resolve: (v: string) => void) => resolve(''))
      setQzStatus('conectando')
      qz.websocket.connect({ retries: 2, delay: 1 })
        .then(() => { qzRef.current = qz; setQzStatus('conectado') })
        .catch(() => setQzStatus('indisponivel'))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).qz) { conectar(); return }
    const script = document.createElement('script')
    script.src = 'https://cdn.qz.io/qz-tray/qz-tray.js'
    script.onload = conectar
    script.onerror = () => setQzStatus('indisponivel')
    document.head.appendChild(script)

    return () => {
      if (qzRef.current?.websocket?.isActive?.()) {
        qzRef.current.websocket.disconnect().catch(() => {})
      }
    }
  }, [])

  function salvarFormato() {
    localStorage.setItem(`tipo7-impressora-${eventoId}`, formatoSel)
    setFormato(formatoSel)
    setSetupAberto(false)
  }

  function baixarAtalhoKiosk() {
    const url = `${window.location.origin}/bilheteria/${eventoId}`
    const bat = [
      '@echo off',
      'echo Abrindo Tipo7 Bilheteria em modo kiosk...',
      `start "" "chrome" --kiosk-printing "${url}"`,
      'if errorlevel 1 start "" "msedge" --kiosk-printing "${url}"',
    ].join('\r\n')
    const blob = new Blob([bat], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tipo7-bilheteria.bat`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // Abre dados do comprador automaticamente ao selecionar PIX (CPF obrigatório)
  useEffect(() => {
    if (metodo === 'pix') setDadosAbertos(true)
  }, [metodo])

  // Imprime automaticamente ao chegar na tela de impressão — QZ Tray (silencioso) ou window.print()
  useEffect(() => {
    if (etapa !== 'impressao' || !resultado || !formato || formato === 'nenhuma') return

    let cancelado = false

    const t = setTimeout(async () => {
      if (cancelado) return

      // Tenta QZ Tray primeiro (impressão silenciosa sem diálogo)
      if (qzStatus === 'conectado' && qzRef.current) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const qrLib = await import('qrcode' as any)
          const { tickets, ticketName } = resultado
          const isTermica = formato === 'termica80'
          const pageW = isTermica ? '76mm' : '185mm'

          const cards = await Promise.all(tickets.map(async (tk: { id: string; slot_number: number; qr_token: string }) => {
            const qrUrl: string = await qrLib.toDataURL(tk.qr_token, { width: 200, margin: 1 })
            return `
              <div style="width:${pageW};padding:8mm;font-family:sans-serif;box-sizing:border-box;page-break-after:always">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6mm">
                  <div style="flex:1">
                    <div style="color:#b8840a;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Tipo7.com</div>
                    <div style="font-size:14px;font-weight:700;margin-bottom:4px">${eventoTitle.replace(/</g, '&lt;')}</div>
                    ${dataFormatada ? `<div style="font-size:10px;color:#555">${dataFormatada}</div>` : ''}
                    ${eventoLocal ? `<div style="font-size:10px;color:#666">${eventoLocal.replace(/</g, '&lt;')}</div>` : ''}
                  </div>
                  <img src="${qrUrl}" style="width:85px;height:85px;flex-shrink:0"/>
                </div>
                <hr style="border:none;border-top:1px dashed #ccc;margin:6px 0"/>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
                  <div><div style="font-size:8px;color:#888;text-transform:uppercase">Tipo</div><div style="font-size:11px;font-weight:600">${ticketName.replace(/</g, '&lt;')}</div></div>
                  <div><div style="font-size:8px;color:#888;text-transform:uppercase">Ingresso</div><div style="font-size:11px;font-weight:600">#${tk.slot_number} de ${tickets.length}</div></div>
                  <div><div style="font-size:8px;color:#888;text-transform:uppercase">Portador</div><div style="font-size:11px;font-weight:600">${(nome || 'Consumidor').replace(/</g, '&lt;')}</div></div>
                  ${cpf ? `<div><div style="font-size:8px;color:#888;text-transform:uppercase">CPF</div><div style="font-size:11px;font-weight:600">${cpf}</div></div>` : ''}
                </div>
                <div style="margin-top:7px;font-size:8px;color:#999;text-align:center">Ingresso válido — apresente o QR code na entrada • tipo7.com</div>
              </div>`
          }))

          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>@page{margin:0}body{margin:0;padding:0}</style></head><body>${cards.join('')}</body></html>`
          const printer = await qzRef.current.printers.getDefault()
          const config = qzRef.current.configs.create(printer)
          await qzRef.current.print(config, [{ type: 'html', format: 'plain', data: html }])
          if (!cancelado) handleNovaVenda()
          return
        } catch (e) {
          console.warn('QZ Tray falhou, usando window.print():', e)
        }
      }

      // Fallback: diálogo padrão do navegador
      window.print()
      if (!cancelado) handleNovaVenda()
    }, 600)

    return () => { cancelado = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, resultado, formato, qzStatus])

  // Cria o canal Realtime ao montar — permite comunicação entre dispositivos
  useEffect(() => {
    const supabase = createSupabase()
    const channel = supabase.channel(`bilheteria-${eventoId}`, {
      config: { broadcast: { self: false } },
    })
    channel.subscribe()
    realtimeRef.current = channel
    return () => { supabase.removeChannel(channel); realtimeRef.current = null }
  }, [eventoId])

  // Abre segunda tela no mesmo browser
  function abrirSegundaTela() {
    if (segundaRef.current && !segundaRef.current.closed) {
      segundaRef.current.focus()
      return
    }
    segundaRef.current = window.open(`/segunda-tela/${eventoId}`, 'tipo7-segunda-tela')
  }

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function fecharFora(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAberto(false)
      }
    }
    document.addEventListener('mousedown', fecharFora)
    return () => document.removeEventListener('mousedown', fecharFora)
  }, [])

  // Countdown do PIX
  useEffect(() => {
    if (etapa !== 'pix' || !pixData?.expiresAt) return
    const calcular = () => {
      const diff = Math.floor((new Date(pixData.expiresAt!).getTime() - Date.now()) / 1000)
      setTempoRestante(diff > 0 ? diff : 0)
    }
    calcular()
    const id = setInterval(calcular, 1000)
    return () => clearInterval(id)
  }, [etapa, pixData?.expiresAt])

  // Confirmação do PIX — gera os ingressos e vai direto para impressão
  const confirmarPix = useCallback(async (orderId: string) => {
    if (confirmando) return
    setConfirmando(true)
    setErr(null)
    try {
      const res = await fetch('/api/bilheteria/pix/confirmar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ orderId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao confirmar pagamento')

      // Salva dados do comprador silenciosamente (CPF já foi coletado antes do PIX)
      if (nome || cpf || telefone || nascimento) {
        fetch('/api/bilheteria/holders', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            orderId,
            comprador: {
              nome:       nome       || undefined,
              cpf:        cpf.replace(/\D/g, '') || undefined,
              telefone:   telefone.replace(/\D/g, '') || undefined,
              nascimento: nascimento || undefined,
            },
          }),
        }).catch(() => {})
      }

      setResultado({ tickets: data.tickets, ticketName: data.ticketName })
      setEtapa('impressao')
      if (pollingRef.current) clearInterval(pollingRef.current)
      pixBroadcastRef.current = null
      const aprovMsg = { type: 'aprovado', ticketName: data.ticketName, quantidade: data.tickets.length }
      localStorage.setItem(`tipo7-pix-${eventoId}`, JSON.stringify(aprovMsg))
      setTimeout(() => localStorage.removeItem(`tipo7-pix-${eventoId}`), 5500)
      realtimeRef.current?.send({ type: 'broadcast', event: 'aprovado', payload: aprovMsg })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao confirmar pagamento')
    } finally {
      setConfirmando(false)
    }
  }, [confirmando, eventoId, nome, cpf, telefone, nascimento])

  // Polling de status do PIX a cada 5s
  useEffect(() => {
    if (etapa !== 'pix' || !pixData) return
    const { orderId } = pixData
    pollingRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/bilheteria/pix/${orderId}`)
        const data = await res.json()
        if (data.status === 'approved') {
          if (pollingRef.current) clearInterval(pollingRef.current)
          await confirmarPix(orderId)
        }
      } catch {
        // silencioso — tenta de novo no próximo ciclo
      }
    }, 5000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [etapa, pixData, confirmarPix])

  const total = (ingressoSelecionado?.price ?? 0) * quantidade

  function formatarCPF(v: string) {
    return v.replace(/\D/g, '').slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  function formatarTelefone(v: string) {
    return v.replace(/\D/g, '').slice(0, 11)
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
  }

  function formatarTempo(s: number) {
    const m = Math.floor(s / 60)
    const seg = s % 60
    return `${m}:${String(seg).padStart(2, '0')}`
  }

  async function handleVender() {
    if (!ticketId) { setErr('Selecione um tipo de ingresso'); return }
    if (!ingressoSelecionado || ingressoSelecionado.disponivel < quantidade) {
      setErr('Quantidade indisponível'); return
    }
    if (metodo === 'pix' && total <= 0) {
      setErr('PIX não disponível para ingressos gratuitos.'); return
    }
    if (metodo === 'pix' && cpf.replace(/\D/g, '').length !== 11) {
      setErr('CPF do comprador é obrigatório para pagamento via PIX (exigência do Banco Central).')
      setDadosAbertos(true)
      return
    }

    setSalvando(true)
    setErr(null)

    // Fluxo PIX — gera QR via Mercado Pago
    if (metodo === 'pix') {
      try {
        const res = await fetch('/api/bilheteria/pix', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            eventoId,
            ticketId,
            quantidade,
            comprador: nome || cpf ? { nome: nome || undefined, cpf: cpf.replace(/\D/g, '') || undefined } : undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar QR PIX')
        setPixData({ orderId: data.orderId, qrCode: data.qrCode, qrCodeBase64: data.qrCodeBase64, total: data.total, expiresAt: data.expiresAt })
        setEtapa('pix')
        const pixPayload = {
          type:         'pix',
          qrCode:       data.qrCode,
          qrCodeBase64: data.qrCodeBase64,
          total:        data.total,
          expiresAt:    data.expiresAt,
          ticketName:   ingressoSelecionado?.name ?? 'Ingresso',
          quantidade,
        }
        pixBroadcastRef.current = pixPayload
        localStorage.setItem(`tipo7-pix-${eventoId}`, JSON.stringify(pixPayload))
        realtimeRef.current?.send({ type: 'broadcast', event: 'pix', payload: pixPayload })
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Erro ao gerar PIX')
      } finally {
        setSalvando(false)
      }
      return
    }

    // Fluxo dinheiro / cartão — registra direto
    try {
      const res = await fetch('/api/bilheteria/vender', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          eventoId,
          ticketId,
          quantidade,
          metodoPagamento: metodo,
          comprador: {
            nome,
            cpf:            cpf.replace(/\D/g, ''),
            telefone:       telefone.replace(/\D/g, ''),
            dataNascimento: nascimento,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao vender ingresso')
      setResultado({ tickets: data.tickets, ticketName: data.ticketName })
      setEtapa('impressao')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao processar venda')
    } finally {
      setSalvando(false)
    }
  }

  function cancelarOrdemAtual() {
    if (pixData?.orderId) {
      fetch('/api/bilheteria/cancelar-pix', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ orderId: pixData.orderId }),
      }).catch(() => {})
    }
  }

  function handleNovaVenda() {
    cancelarOrdemAtual()
    setEtapa('venda')
    setNome('')
    setCpf('')
    setTelefone('')
    setNascimento('')
    setQuantidade(1)
    setResultado(null)
    setPendingTickets(null)
    setPixData(null)
    setErr(null)
    setDadosAbertos(false)
    setSalvandoDados(false)
    setCopiado(false)
    setTempoRestante(null)
    if (pollingRef.current) clearInterval(pollingRef.current)
    pixBroadcastRef.current = null
    localStorage.removeItem(`tipo7-pix-${eventoId}`)
    realtimeRef.current?.send({ type: 'broadcast', event: 'cancelado', payload: {} })
  }

  async function gerarNovoPix() {
    cancelarOrdemAtual()
    setPixData(null)
    setTempoRestante(null)
    setErr(null)
    setCopiado(false)
    if (pollingRef.current) clearInterval(pollingRef.current)
    pixBroadcastRef.current = null
    localStorage.removeItem(`tipo7-pix-${eventoId}`)
    realtimeRef.current?.send({ type: 'broadcast', event: 'cancelado', payload: {} })
    await handleVender()
  }

  async function handleSubmitDados() {
    if (!pendingTickets || !pixData) return
    setSalvandoDados(true)
    setErr(null)
    try {
      if (nome || cpf || telefone || nascimento) {
        const res = await fetch('/api/bilheteria/holders', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            orderId:   pixData.orderId,
            comprador: {
              nome:       nome || undefined,
              cpf:        cpf.replace(/\D/g, '') || undefined,
              telefone:   telefone.replace(/\D/g, '') || undefined,
              nascimento: nascimento || undefined,
            },
          }),
        })
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.error ?? 'Erro ao salvar dados')
        }
      }
      setResultado(pendingTickets)
      setEtapa('impressao')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar dados')
    } finally {
      setSalvandoDados(false)
    }
  }

  async function copiarQr() {
    if (!pixData?.qrCode) return
    await navigator.clipboard.writeText(pixData.qrCode)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  const dataFormatada = eventoDate
    ? new Date(eventoDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  // ── Tela de aguardo do PIX ─────────────────────────────────────────────────
  if (etapa === 'pix' && pixData) {
    const expirado = tempoRestante !== null && tempoRestante <= 0
    return (
      <div className="min-h-dvh bg-[#070707]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#111] flex items-center gap-3">
          <button
            onClick={handleNovaVenda}
            className="flex items-center gap-2 text-sm text-[#666] hover:text-white transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            <ArrowLeft size={14} />
            Cancelar
          </button>
        </div>

        <div className="max-w-md mx-auto px-5 py-8 flex flex-col items-center gap-6">
          {/* Título */}
          <div className="text-center">
            <p className="text-[#555] text-xs uppercase tracking-widest mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Aguardando pagamento
            </p>
            <h2 className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>
              R$ {pixData.total.toFixed(2).replace('.', ',')}
            </h2>
          </div>

          {/* QR Code */}
          {pixData.qrCodeBase64 ? (
            <div className="bg-white p-4 rounded-2xl">
              <img
                src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                alt="QR Code PIX"
                width={220}
                height={220}
              />
            </div>
          ) : pixData.qrCode ? (
            <div className="bg-white p-4 rounded-2xl">
              <QRCode value={pixData.qrCode} size={220} />
            </div>
          ) : (
            <div
              className="w-[252px] h-[252px] rounded-2xl flex items-center justify-center"
              style={{ background: '#111', border: '1px solid #1e1e1e' }}
            >
              <Loader2 size={32} className="animate-spin text-[#333]" />
            </div>
          )}

          {/* Temporizador */}
          {tempoRestante !== null && (
            <div className="flex items-center gap-2">
              <Clock size={13} className={expirado ? 'text-red-400' : 'text-[#555]'} />
              <span
                className="text-sm font-mono"
                style={{ color: expirado ? '#f87171' : '#888', fontFamily: 'var(--font-dm-sans)' }}
              >
                {expirado ? 'PIX expirado' : `Expira em ${formatarTempo(tempoRestante)}`}
              </span>
            </div>
          )}

          {/* Copia e cola */}
          {pixData.qrCode && (
            <div
              className="w-full rounded-2xl p-4 flex flex-col gap-3"
              style={{ background: '#0d0d0d', border: '1px solid #1e1e1e' }}
            >
              <p className="text-[#555] text-[11px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                PIX copia e cola
              </p>
              <p
                className="text-[#888] text-xs break-all leading-relaxed"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                {pixData.qrCode.slice(0, 80)}…
              </p>
              <button
                type="button"
                onClick={copiarQr}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{
                  background: copiado ? '#1a2e1a' : '#111',
                  border:     `1px solid ${copiado ? '#2d5a2d' : '#1e1e1e'}`,
                  color:      copiado ? '#4ade80' : '#888',
                  fontFamily: 'var(--font-dm-sans)',
                }}
              >
                {copiado
                  ? <><CheckCircle2 size={14} /> Copiado!</>
                  : <><Copy size={14} /> Copiar código</>
                }
              </button>
            </div>
          )}

          {err && (
            <div className="flex items-center gap-2 text-red-400 text-sm py-3 px-4 rounded-xl bg-red-400/5 border border-red-400/10 w-full">
              <AlertTriangle size={14} className="shrink-0" />
              {err}
            </div>
          )}

          {expirado ? (
            /* ── PIX expirado: duas opções ── */
            <div className="w-full flex flex-col gap-3">
              <p className="text-[#555] text-sm text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                O QR code expirou. O que o cliente deseja fazer?
              </p>
              <button
                type="button"
                onClick={gerarNovoPix}
                disabled={salvando}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold text-[#070707] disabled:opacity-50 transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
              >
                {salvando
                  ? <><Loader2 size={18} className="animate-spin" /> Gerando...</>
                  : <><Smartphone size={18} /> Gerar novo QR PIX</>
                }
              </button>
              <button
                type="button"
                onClick={handleNovaVenda}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all hover:border-[#333] active:scale-[0.98]"
                style={{
                  background:  '#0d0d0d',
                  border:      '1px solid #1e1e1e',
                  color:       '#666',
                  fontFamily:  'var(--font-dm-sans)',
                }}
              >
                <ArrowLeft size={15} />
                Cancelar venda
              </button>
            </div>
          ) : (
            /* ── PIX ativo: confirmar manualmente ── */
            <div className="w-full flex flex-col gap-3">
              <button
                type="button"
                onClick={() => confirmarPix(pixData.orderId)}
                disabled={confirmando}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold text-[#070707] disabled:opacity-50 transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
              >
                {confirmando
                  ? <><Loader2 size={18} className="animate-spin" /> Confirmando...</>
                  : <><CheckCircle2 size={18} /> Confirmar pagamento recebido</>
                }
              </button>
              <p className="text-[#2a2a2a] text-[11px] text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Use este botão se o cliente já pagou mas a confirmação automática ainda não chegou.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Tela de dados do comprador ────────────────────────────────────────────
  if (etapa === 'dados' && pendingTickets) {
    return (
      <div className="min-h-dvh bg-[#070707]">

        {/* Banner de sucesso */}
        <div
          className="px-6 py-5 flex items-center gap-4"
          style={{ background: 'rgba(74,222,128,0.06)', borderBottom: '1px solid rgba(74,222,128,0.15)' }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)' }}
          >
            <CheckCircle2 size={20} className="text-green-400" />
          </div>
          <div>
            <p className="text-green-400 text-sm font-bold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Pagamento confirmado!
            </p>
            <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {pendingTickets.tickets.length} ingresso{pendingTickets.tickets.length > 1 ? 's' : ''} — {pendingTickets.ticketName}
            </p>
          </div>
        </div>

        <div className="max-w-md mx-auto px-5 py-6 flex flex-col gap-6">
          <div>
            <h2 className="text-white text-lg font-bold mb-0.5" style={{ fontFamily: 'var(--font-syne)' }}>
              Dados do comprador
            </h2>
            <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Preencha para identificar o ingresso ou pule direto para impressão
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Nome completo"
                autoFocus
                className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
            </div>

            <div className="relative">
              <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
              <input
                type="text"
                value={cpf}
                onChange={e => setCpf(formatarCPF(e.target.value))}
                placeholder="CPF"
                className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
            </div>

            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
              <input
                type="tel"
                value={telefone}
                onChange={e => setTelefone(formatarTelefone(e.target.value))}
                placeholder="Telefone"
                className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
            </div>

            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
              <input
                type="date"
                value={nascimento}
                onChange={e => setNascimento(e.target.value)}
                className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                style={{ fontFamily: 'var(--font-dm-sans)', colorScheme: 'dark' }}
              />
            </div>
          </div>

          {err && (
            <div className="flex items-center gap-2 text-red-400 text-sm py-3 px-4 rounded-xl bg-red-400/5 border border-red-400/10">
              <AlertTriangle size={14} className="shrink-0" />
              {err}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmitDados}
            disabled={salvandoDados}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold text-[#070707] disabled:opacity-50 transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
          >
            {salvandoDados
              ? <><Loader2 size={18} className="animate-spin" /> Salvando...</>
              : <><Printer size={18} /> Salvar e imprimir ingresso</>
            }
          </button>

          <button
            type="button"
            onClick={() => { setResultado(pendingTickets); setEtapa('impressao') }}
            className="text-center text-[#3a3a3a] text-sm hover:text-[#666] transition-colors py-1"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Pular e imprimir sem dados
          </button>
        </div>
      </div>
    )
  }

  // ── Tela de impressão ─────────────────────────────────────────────────────
  if (etapa === 'impressao' && resultado) {
    return (
      <div className="min-h-dvh bg-[#070707]">
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-[#111]">
          <button
            onClick={handleNovaVenda}
            className="flex items-center gap-2 text-sm text-[#666] hover:text-white transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            <ArrowLeft size={14} />
            Nova venda
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#070707]"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
          >
            <Printer size={14} />
            Imprimir
          </button>
        </div>

        {/* Um card por ingresso — cada um com seu próprio QR */}
        <div ref={printRef} className="p-6 flex flex-col gap-6 max-w-md mx-auto">
          {resultado.tickets.map(t => (
            <div
              key={t.id}
              className="ingresso-print rounded-2xl p-6 flex flex-col gap-4"
              style={{ border: `1px solid ${ACCENT}40`, background: '#0d0d0d' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[#E8B84B] text-xs font-bold uppercase tracking-widest mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Tipo7.com
                  </p>
                  <h2 className="text-white text-lg font-bold leading-tight" style={{ fontFamily: 'var(--font-syne)' }}>
                    {eventoTitle}
                  </h2>
                  {dataFormatada && (
                    <p className="text-[#888] text-xs mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>{dataFormatada}</p>
                  )}
                  {eventoLocal && (
                    <p className="text-[#666] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>{eventoLocal}</p>
                  )}
                </div>
                <div className="bg-white p-2 rounded-xl shrink-0">
                  <QRCode value={t.qr_token} size={100} />
                </div>
              </div>

              <div style={{ borderTop: `1px dashed ${ACCENT}30` }} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[#555] text-[10px] uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>Tipo</p>
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>{resultado.ticketName}</p>
                </div>
                <div>
                  <p className="text-[#555] text-[10px] uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>Ingresso</p>
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>#{t.slot_number} de {resultado.tickets.length}</p>
                </div>
                <div>
                  <p className="text-[#555] text-[10px] uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>Portador</p>
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>{nome || 'Consumidor'}</p>
                </div>
                {cpf && (
                  <div>
                    <p className="text-[#555] text-[10px] uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>CPF</p>
                    <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>{cpf}</p>
                  </div>
                )}
              </div>

              <div style={{ borderTop: `1px dashed ${ACCENT}30` }} />
              <p className="text-[#333] text-[9px] text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Ingresso válido — apresente o QR code na entrada • tipo7.com
              </p>
            </div>
          ))}
        </div>

        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
            .ingresso-print {
              border: 1px solid #ccc !important;
              background: white !important;
              page-break-after: always;
            }
            h2, p { color: #000 !important; }
          }
        `}</style>
      </div>
    )
  }

  // ── Tela de setup de impressão ────────────────────────────────────────────
  if (!formato || setupAberto) {
    return (
      <div className="min-h-dvh bg-[#070707] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#111] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30` }}>
            <Settings size={16} style={{ color: ACCENT }} />
          </div>
          <div className="flex-1">
            <h1 className="text-white text-base font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
              Configurar impressão
            </h1>
            <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {eventoTitle} • escolha o formato antes de abrir o caixa
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={abrirSegundaTela}
              title="Abrir segunda tela para o cliente"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-colors hover:border-[#333]"
              style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', color: '#555', fontFamily: 'var(--font-dm-sans)' }}
            >
              <Monitor size={13} />
              Segunda tela
            </button>
            {setupAberto && (
              <button type="button" onClick={() => setSetupAberto(false)}
                className="text-[#444] hover:text-white text-xs transition-colors"
                style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Cancelar
              </button>
            )}
          </div>
        </div>

        <div className="max-w-md mx-auto w-full px-5 py-8 flex flex-col gap-8">

          {/* Seleção de formato */}
          <div className="flex flex-col gap-3">
            <p className="text-[#555] text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Formato do papel
            </p>
            <div className="flex flex-col gap-2">
              {PRINT_FORMATS.map(f => (
                <button key={f.value} type="button" onClick={() => setFormatoSel(f.value)}
                  className="flex items-center gap-4 px-4 py-4 rounded-2xl text-left transition-all"
                  style={{
                    background: formatoSel === f.value ? `${ACCENT}10` : '#0d0d0d',
                    border: `1px solid ${formatoSel === f.value ? ACCENT + '50' : '#1a1a1a'}`,
                  }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                       style={{ background: formatoSel === f.value ? `${ACCENT}20` : '#111' }}>
                    <f.Icon size={18} style={{ color: formatoSel === f.value ? ACCENT : '#444' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {f.label}
                    </p>
                    <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {f.sub}
                    </p>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                       style={{ borderColor: formatoSel === f.value ? ACCENT : '#333',
                                background:  formatoSel === f.value ? ACCENT : 'transparent' }}>
                    {formatoSel === f.value && <div className="w-2 h-2 rounded-full bg-[#070707]" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Seção impressão silenciosa */}
          {formatoSel !== 'nenhuma' && (
            <div className="rounded-2xl p-4 flex flex-col gap-3"
                 style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
              <p className="text-white text-xs font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Impressão silenciosa (sem diálogo)
              </p>
              <p className="text-[#444] text-xs leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Para imprimir automaticamente sem confirmar a cada venda, abra o Chrome com o atalho abaixo e configure a impressora desejada como <strong className="text-[#666]">padrão no Windows</strong>.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={baixarAtalhoKiosk}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors hover:brightness-110"
                  style={{ background: ACCENT, color: '#070707', fontFamily: 'var(--font-dm-sans)' }}>
                  <Download size={13} />
                  Baixar atalho .bat
                </button>
                <button type="button"
                  onClick={() => navigator.clipboard.writeText(`chrome --kiosk-printing "${window.location.origin}/bilheteria/${eventoId}"`)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-colors hover:border-[#333] hover:text-white"
                  style={{ border: '1px solid #1e1e1e', color: '#555', fontFamily: 'var(--font-dm-sans)' }}>
                  <Copy size={13} />
                  Copiar comando
                </button>
              </div>
            </div>
          )}

          {/* Status do QZ Tray */}
          <div className="rounded-2xl p-4 flex items-center justify-between gap-4"
               style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full shrink-0" style={{
                background: qzStatus === 'conectado' ? '#4ade80'
                          : qzStatus === 'conectando' ? ACCENT
                          : '#2a2a2a',
              }} />
              <div>
                <p className="text-white text-xs font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  QZ Tray — impressão silenciosa
                </p>
                <p className="text-[#444] text-[11px] mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {qzStatus === 'conectado'    && 'Conectado — zero cliques para imprimir'}
                  {qzStatus === 'conectando'   && 'Conectando...'}
                  {qzStatus === 'indisponivel' && 'Não detectado — instale e ative "Allow unsigned"'}
                  {qzStatus === 'idle'         && 'Carregando...'}
                </p>
              </div>
            </div>
            {qzStatus === 'indisponivel' && (
              <a
                href="https://qz.io/download/"
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-xs underline"
                style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
              >
                Instalar
              </a>
            )}
          </div>

          {/* Botão abrir caixa */}
          <button type="button" onClick={salvarFormato}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold text-[#070707] transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
            <ShoppingBag size={18} />
            {setupAberto ? 'Salvar e voltar' : 'Abrir caixa'}
          </button>

        </div>
      </div>
    )
  }

  // ── Tela de venda ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-[#070707]">

      {/* Header */}
      <div className="px-6 py-5 border-b border-[#111] flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30` }}
        >
          <ShoppingBag size={16} style={{ color: ACCENT }} />
        </div>
        <div className="flex-1">
          <h1 className="text-white text-base font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            Bilheteria
          </h1>
          <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {eventoTitle} • {operadorName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={abrirSegundaTela}
            title="Abrir segunda tela para o cliente"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-colors hover:border-[#333]"
            style={{
              background:  '#0d0d0d',
              border:      '1px solid #1e1e1e',
              color:       '#555',
              fontFamily:  'var(--font-dm-sans)',
            }}
          >
            <Monitor size={13} />
            Segunda tela
          </button>
          <button
            type="button"
            onClick={() => { setSetupAberto(true); setFormatoSel(formato ?? 'a4') }}
            title={`Configurar impressora${qzStatus === 'conectado' ? ' • QZ Tray ativo' : ''}`}
            className="relative w-8 h-8 flex items-center justify-center rounded-xl transition-colors hover:border-[#333]"
            style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', color: '#555' }}
          >
            <Settings size={14} />
            {qzStatus === 'conectado' && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400" />
            )}
          </button>
          <Link
            href={`/dashboard/${eventoId}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-colors hover:border-[#333] hover:text-white"
            style={{
              background:  '#0d0d0d',
              border:      '1px solid #1e1e1e',
              color:       '#555',
              fontFamily:  'var(--font-dm-sans)',
            }}
          >
            <ArrowLeft size={13} />
            Voltar
          </Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-6">

        {/* Tipo de ingresso — dropdown customizado */}
        <div ref={dropdownRef} className="relative">
          <label className="text-[#555] text-xs uppercase tracking-wider mb-2 block" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Tipo de ingresso
          </label>

          {/* Botão disparador */}
          <button
            type="button"
            onClick={() => setDropdownAberto(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm text-left transition-colors"
            style={{
              background: '#0d0d0d',
              border: `1px solid ${dropdownAberto ? ACCENT + '50' : '#1e1e1e'}`,
              fontFamily: 'var(--font-dm-sans)',
            }}
          >
            {ingressoSelecionado ? (
              <div className="flex items-center justify-between flex-1 mr-3">
                <span className="text-white">{ingressoSelecionado.name}</span>
                <span style={{ color: ACCENT }} className="font-semibold text-sm">
                  {ingressoSelecionado.price === 0
                    ? 'Grátis'
                    : `R$ ${ingressoSelecionado.price.toFixed(2).replace('.', ',')}`}
                </span>
              </div>
            ) : (
              <span className="text-[#444]">Selecione o tipo de ingresso</span>
            )}
            <ChevronDown
              size={14}
              className="text-[#444] transition-transform shrink-0"
              style={{ transform: dropdownAberto ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>

          {/* Lista flutuante — sobrepõe o conteúdo abaixo */}
          {dropdownAberto && (
            <div
              className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-50 flex flex-col"
              style={{ background: '#0d0d0d', border: `1px solid ${ACCENT}30`, boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
            >
              {ingressos.length === 0 ? (
                <p className="text-[#444] text-sm text-center py-4 px-4" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Nenhum ingresso disponível
                </p>
              ) : (
                ingressos.map((i, idx) => (
                  <button
                    key={i.id}
                    type="button"
                    disabled={i.disponivel === 0}
                    onClick={() => { setTicketId(i.id); setDropdownAberto(false) }}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors disabled:opacity-40"
                    style={{
                      background: ticketId === i.id ? `${ACCENT}10` : 'transparent',
                      borderTop: idx > 0 ? '1px solid #1a1a1a' : 'none',
                      fontFamily: 'var(--font-dm-sans)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {ticketId === i.id && <Check size={12} style={{ color: ACCENT }} />}
                      {ticketId !== i.id && <div className="w-3" />}
                      <div>
                        <p className="text-white text-sm">{i.name}</p>
                        <p className="text-[#555] text-[11px] mt-0.5">
                          {i.disponivel === 0 ? 'Esgotado' : `${i.disponivel} disponíveis`}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-sm" style={{ color: ACCENT }}>
                      {i.price === 0 ? 'Grátis' : `R$ ${i.price.toFixed(2).replace('.', ',')}`}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Quantidade */}
        <div>
          <label className="text-[#555] text-xs uppercase tracking-wider mb-3 block" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Quantidade
          </label>

          {/* Botões rápidos */}
          <div className="flex gap-2 mb-3">
            {QTDS_RAPIDAS.map(q => (
              <button
                key={q}
                type="button"
                onClick={() => setQuantidade(q)}
                disabled={q > (ingressoSelecionado?.disponivel ?? 0)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-25"
                style={{
                  background: quantidade === q ? ACCENT : '#111',
                  border:     `1px solid ${quantidade === q ? ACCENT : '#1e1e1e'}`,
                  color:      quantidade === q ? '#070707' : '#555',
                  fontFamily: 'var(--font-outfit)',
                }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Controle manual para quantidades maiores */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantidade(q => Math.max(1, q - 1))}
              className="w-12 h-12 rounded-xl border border-[#1e1e1e] text-white text-xl flex items-center justify-center hover:border-[#333] transition-colors active:scale-95"
            >
              −
            </button>
            <span className="text-white text-2xl font-semibold w-10 text-center" style={{ fontFamily: 'var(--font-outfit)' }}>
              {quantidade}
            </span>
            <button
              type="button"
              onClick={() => setQuantidade(q => Math.min(ingressoSelecionado?.disponivel ?? 1, q + 1))}
              className="w-12 h-12 rounded-xl border border-[#1e1e1e] text-white text-xl flex items-center justify-center hover:border-[#333] transition-colors active:scale-95"
            >
              +
            </button>
          </div>
        </div>

        {/* Total em destaque */}
        {ingressoSelecionado && (
          <div
            className="rounded-2xl px-5 py-4 flex items-center justify-between"
            style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}20` }}
          >
            <span className="text-[#888] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {quantidade}× R$ {ingressoSelecionado.price.toFixed(2).replace('.', ',')}
            </span>
            <span className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-outfit)', color: ACCENT }}>
              R$ {total.toFixed(2).replace('.', ',')}
            </span>
          </div>
        )}

        {/* Método de pagamento */}
        <div>
          <label className="text-[#555] text-xs uppercase tracking-wider mb-3 block" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Forma de pagamento
          </label>
          <div className="grid grid-cols-3 gap-2">
            {METODOS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMetodo(value)}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-colors"
                style={{
                  background: metodo === value ? `${ACCENT}15` : '#0d0d0d',
                  border:     `1px solid ${metodo === value ? ACCENT + '50' : '#1e1e1e'}`,
                }}
              >
                <Icon size={18} style={{ color: metodo === value ? ACCENT : '#555' }} />
                <span
                  className="text-xs font-medium"
                  style={{ color: metodo === value ? '#ddd' : '#555', fontFamily: 'var(--font-dm-sans)' }}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Dados do comprador (colapsável) */}
        <div>
          <button
            type="button"
            onClick={() => setDadosAbertos(v => !v)}
            className="w-full flex items-center justify-between py-2 text-left"
          >
            <div className="flex items-center gap-2">
              <User size={13} className="text-[#444]" />
              <span className="text-[#555] text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Dados do comprador
              </span>
              {metodo === 'pix'
                ? <span className="text-red-400 text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>(CPF obrigatório para PIX)</span>
                : <span className="text-[#333] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>(opcional)</span>
              }
            </div>
            {dadosAbertos
              ? <ChevronUp size={13} className="text-[#444]" />
              : <ChevronDown size={13} className="text-[#444]" />
            }
          </button>

          {dadosAbertos && (
            <div className="flex flex-col gap-3 mt-3">
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
              </div>

              <div className="relative">
                <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
                <input
                  type="text"
                  value={cpf}
                  onChange={e => setCpf(formatarCPF(e.target.value))}
                  placeholder={metodo === 'pix' ? 'CPF (obrigatório para PIX)' : 'CPF'}
                  className="w-full bg-[#0d0d0d] rounded-xl pl-9 pr-4 py-3 text-white text-sm outline-none placeholder:text-[#383838]"
                  style={{
                    fontFamily: 'var(--font-dm-sans)',
                    border: metodo === 'pix' && cpf.replace(/\D/g, '').length !== 11
                      ? '1px solid rgba(248,113,113,0.4)'
                      : '1px solid #1e1e1e',
                  }}
                />
              </div>

              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
                <input
                  type="tel"
                  value={telefone}
                  onChange={e => setTelefone(formatarTelefone(e.target.value))}
                  placeholder="Telefone"
                  className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
              </div>

              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
                <input
                  type="date"
                  value={nascimento}
                  onChange={e => setNascimento(e.target.value)}
                  placeholder="Data de nascimento"
                  className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                  style={{ fontFamily: 'var(--font-dm-sans)', colorScheme: 'dark' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Erro */}
        {err && (
          <div className="flex items-center gap-2 text-red-400 text-sm py-3 px-4 rounded-xl bg-red-400/5 border border-red-400/10">
            <AlertTriangle size={14} className="shrink-0" />
            {err}
          </div>
        )}

        {/* Botão de venda */}
        <button
          type="button"
          onClick={handleVender}
          disabled={salvando || !ingressoSelecionado || ingressoSelecionado.disponivel === 0}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold text-[#070707] disabled:opacity-50 transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
        >
          {salvando
            ? <><Loader2 size={18} className="animate-spin" /> Processando...</>
            : metodo === 'pix'
              ? <><Smartphone size={18} /> Gerar QR PIX</>
              : <><Check size={18} /> Confirmar venda</>
          }
        </button>

        {ingressos.length === 0 && (
          <p className="text-center text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Nenhum ingresso disponível para este evento.
          </p>
        )}
      </div>
    </div>
  )
}
