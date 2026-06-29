'use client'

import { useState, useRef } from 'react'
import { Ticket, User, Phone, CreditCard, Calendar, Printer, ChevronDown, Loader2, Check, AlertTriangle, ShoppingBag, ArrowLeft } from 'lucide-react'
import QRCode from 'react-qr-code'

const ACCENT = '#E8B84B'

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

interface Props {
  eventoId:     string
  eventoTitle:  string
  eventoDate:   string | null
  eventoLocal:  string
  ingressos:    Ingresso[]
  operadorName: string
}

export function BilheteiroClient({ eventoId, eventoTitle, eventoDate, eventoLocal, ingressos, operadorName }: Props) {
  const [etapa,       setEtapa]       = useState<'venda' | 'impressao'>('venda')
  const [ticketId,    setTicketId]    = useState(ingressos[0]?.id ?? '')
  const [quantidade,  setQuantidade]  = useState(1)
  const [nome,        setNome]        = useState('')
  const [cpf,         setCpf]        = useState('')
  const [telefone,    setTelefone]    = useState('')
  const [nascimento,  setNascimento]  = useState('')
  const [salvando,    setSalvando]    = useState(false)
  const [err,         setErr]         = useState<string | null>(null)
  const [resultado,   setResultado]   = useState<{ tickets: TicketGerado[]; ticketName: string } | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const ingressoSelecionado = ingressos.find(i => i.id === ticketId)

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

  async function handleVender() {
    if (!nome.trim()) { setErr('Nome do comprador é obrigatório'); return }
    if (!ticketId)    { setErr('Selecione um tipo de ingresso'); return }
    if (!ingressoSelecionado || ingressoSelecionado.disponivel < quantidade) {
      setErr('Quantidade indisponível'); return
    }

    setSalvando(true)
    setErr(null)
    try {
      const res = await fetch('/api/bilheteria/vender', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          eventoId,
          ticketId,
          quantidade,
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

  function handleImprimir() {
    window.print()
  }

  function handleNovaVenda() {
    setEtapa('venda')
    setNome('')
    setCpf('')
    setTelefone('')
    setNascimento('')
    setQuantidade(1)
    setResultado(null)
    setErr(null)
  }

  const dataFormatada = eventoDate
    ? new Date(eventoDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  // Tela de impressão
  if (etapa === 'impressao' && resultado) {
    return (
      <div className="min-h-dvh bg-[#070707]">

        {/* Ações — não aparecem na impressão */}
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
            onClick={handleImprimir}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#070707]"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
          >
            <Printer size={14} />
            Imprimir
          </button>
        </div>

        {/* Ingressos para impressão */}
        <div ref={printRef} className="p-6 flex flex-col gap-6 max-w-md mx-auto">
          {resultado.tickets.map(t => (
            <div
              key={t.id}
              className="ingresso-print rounded-2xl p-6 flex flex-col gap-4"
              style={{ border: `1px solid ${ACCENT}40`, background: '#0d0d0d' }}
            >
              {/* Cabeçalho */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[#E8B84B] text-xs font-bold uppercase tracking-widest mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Tipo7.com
                  </p>
                  <h2 className="text-white text-lg font-bold leading-tight" style={{ fontFamily: 'var(--font-syne)' }}>
                    {eventoTitle}
                  </h2>
                  {dataFormatada && (
                    <p className="text-[#888] text-xs mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {dataFormatada}
                    </p>
                  )}
                  {eventoLocal && (
                    <p className="text-[#666] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {eventoLocal}
                    </p>
                  )}
                </div>
                {/* QR Code */}
                <div className="bg-white p-2 rounded-xl shrink-0">
                  <QRCode value={t.qr_token} size={100} />
                </div>
              </div>

              {/* Divisor */}
              <div style={{ borderTop: `1px dashed ${ACCENT}30` }} />

              {/* Dados do ingresso */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[#555] text-[10px] uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Tipo
                  </p>
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {resultado.ticketName}
                  </p>
                </div>
                <div>
                  <p className="text-[#555] text-[10px] uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Ingresso
                  </p>
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    #{t.slot_number} de {resultado.tickets.length}
                  </p>
                </div>
                <div>
                  <p className="text-[#555] text-[10px] uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Portador
                  </p>
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {nome}
                  </p>
                </div>
                {cpf && (
                  <div>
                    <p className="text-[#555] text-[10px] uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      CPF
                    </p>
                    <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {cpf}
                    </p>
                  </div>
                )}
              </div>

              {/* Rodapé */}
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

  // Tela de venda
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
        <div>
          <h1 className="text-white text-base font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            Bilheteria
          </h1>
          <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {eventoTitle} • {operadorName}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Tipo de ingresso */}
        <div>
          <label className="text-[#555] text-xs uppercase tracking-wider mb-2 block" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Tipo de ingresso
          </label>
          <div className="relative">
            <select
              value={ticketId}
              onChange={e => setTicketId(e.target.value)}
              className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl px-4 py-3 text-white text-sm outline-none appearance-none focus:border-[#E8B84B]/40"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              {ingressos.map(i => (
                <option key={i.id} value={i.id} disabled={i.disponivel === 0}>
                  {i.name} — R$ {i.price.toFixed(2).replace('.', ',')} ({i.disponivel} disponíveis)
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
          </div>
          {ingressoSelecionado && (
            <div className="mt-2 flex items-center gap-2">
              <Ticket size={12} style={{ color: ACCENT }} />
              <span className="text-[#E8B84B] text-xs font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {ingressoSelecionado.disponivel} disponíveis
              </span>
            </div>
          )}
        </div>

        {/* Quantidade */}
        <div>
          <label className="text-[#555] text-xs uppercase tracking-wider mb-2 block" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Quantidade
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantidade(q => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-xl border border-[#1e1e1e] text-white text-lg flex items-center justify-center hover:border-[#333] transition-colors"
            >
              −
            </button>
            <span className="text-white text-xl font-semibold w-8 text-center" style={{ fontFamily: 'var(--font-outfit)' }}>
              {quantidade}
            </span>
            <button
              type="button"
              onClick={() => setQuantidade(q => Math.min(ingressoSelecionado?.disponivel ?? 1, q + 1))}
              className="w-10 h-10 rounded-xl border border-[#1e1e1e] text-white text-lg flex items-center justify-center hover:border-[#333] transition-colors"
            >
              +
            </button>
            {ingressoSelecionado && (
              <span className="text-[#444] text-sm ml-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Total: R$ {(ingressoSelecionado.price * quantidade).toFixed(2).replace('.', ',')}
              </span>
            )}
          </div>
        </div>

        {/* Dados do comprador */}
        <div className="flex flex-col gap-3">
          <p className="text-[#555] text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Dados do comprador
          </p>

          {/* Nome */}
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Nome completo *"
              className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
          </div>

          {/* CPF */}
          <div className="relative">
            <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
            <input
              type="text"
              value={cpf}
              onChange={e => setCpf(formatarCPF(e.target.value))}
              placeholder="CPF (opcional)"
              className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
          </div>

          {/* Telefone */}
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
            <input
              type="tel"
              value={telefone}
              onChange={e => setTelefone(formatarTelefone(e.target.value))}
              placeholder="Telefone (opcional)"
              className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
          </div>

          {/* Data de nascimento */}
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
            <input
              type="date"
              value={nascimento}
              onChange={e => setNascimento(e.target.value)}
              placeholder="Data de nascimento (opcional)"
              className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
              style={{ fontFamily: 'var(--font-dm-sans)', colorScheme: 'dark' }}
            />
          </div>
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
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-semibold text-[#070707] disabled:opacity-50 transition-all hover:brightness-110"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
        >
          {salvando
            ? <><Loader2 size={16} className="animate-spin" /> Processando...</>
            : <><Check size={16} /> Confirmar venda e gerar ingresso</>
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
