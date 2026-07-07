'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Ticket, User, Phone, CreditCard, Calendar, Printer, ChevronDown,
  Loader2, Check, AlertTriangle, ShoppingBag, ArrowLeft, Banknote,
  Smartphone, CreditCard as CardIcon, ChevronUp,
} from 'lucide-react'
import QRCode from 'react-qr-code'

const ACCENT = '#E8B84B'

type MetodoPagamento = 'dinheiro' | 'pix' | 'cartao'

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

const METODOS: { value: MetodoPagamento; label: string; Icon: React.ElementType }[] = [
  { value: 'dinheiro', label: 'Dinheiro', Icon: Banknote    },
  { value: 'pix',      label: 'PIX',      Icon: Smartphone  },
  { value: 'cartao',   label: 'Cartão',   Icon: CardIcon    },
]

const QTDS_RAPIDAS = [1, 2, 3, 4, 5]

export function BilheteiroClient({ eventoId, eventoTitle, eventoDate, eventoLocal, ingressos, operadorName }: Props) {
  const [etapa,             setEtapa]             = useState<'venda' | 'impressao'>('venda')
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
  const [err,               setErr]               = useState<string | null>(null)
  const [resultado,         setResultado]         = useState<{ tickets: TicketGerado[]; ticketName: string } | null>(null)
  const printRef     = useRef<HTMLDivElement>(null)
  const dropdownRef  = useRef<HTMLDivElement>(null)

  const ingressoSelecionado = ingressos.find(i => i.id === ticketId)

  useEffect(() => {
    function fecharFora(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAberto(false)
      }
    }
    document.addEventListener('mousedown', fecharFora)
    return () => document.removeEventListener('mousedown', fecharFora)
  }, [])
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

  async function handleVender() {
    if (!ticketId) { setErr('Selecione um tipo de ingresso'); return }
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

  function handleNovaVenda() {
    setEtapa('venda')
    setNome('')
    setCpf('')
    setTelefone('')
    setNascimento('')
    setQuantidade(1)
    setResultado(null)
    setErr(null)
    setDadosAbertos(false)
  }

  const dataFormatada = eventoDate
    ? new Date(eventoDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

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
        <div>
          <h1 className="text-white text-base font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            Bilheteria
          </h1>
          <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {eventoTitle} • {operadorName}
          </p>
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
              <span className="text-[#333] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>(opcional)</span>
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
