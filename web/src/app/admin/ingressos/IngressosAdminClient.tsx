'use client'

import { useState } from 'react'
import { Search, Loader2, Ticket, User, Calendar, CreditCard, CheckCircle2, XCircle } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'

const ACCENT = '#E8B84B'

interface Resultado {
  ticket_id:          string
  qr_token:           string
  ticket_status:      string
  slot_number:        number
  validated_at:       string | null
  order_id:           string
  order_status:       string
  total:              number
  payment_method:     string | null
  gateway:            string
  mp_payment_id:      string | null
  pagbank_charge_id:  string | null
  order_created_at:   string
  comprador:          { id: string; nome: string | null; email: string | null; cpf: string | null; telefone: string | null } | null
  evento:             { id: string; titulo: string | null }
  tipo_ingresso:      string | null
  portador:           { nome: string | null; cpf: string | null; email: string | null; telefone: string | null } | null
}

function fmtMoney(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
function fmtCPF(cpf: string | null) {
  if (!cpf) return null
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

const ORDER_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  approved:   { label: 'Aprovado',   color: '#4ade80' },
  pending:    { label: 'Pendente',   color: '#facc15' },
  in_process: { label: 'Em análise', color: '#facc15' },
  rejected:   { label: 'Rejeitado',  color: '#f87171' },
  cancelled:  { label: 'Cancelado',  color: '#666' },
}

export function IngressosAdminClient() {
  const [q,          setQ]          = useState('')
  const [loading,    setLoading]    = useState(false)
  const [buscou,     setBuscou]     = useState(false)
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [erro,       setErro]       = useState<string | null>(null)

  async function buscar(e: React.FormEvent) {
    e.preventDefault()
    const query = q.trim()
    if (!query) return
    setLoading(true)
    setErro(null)
    try {
      const res = await apiFetchAuth(`/api/admin/ingressos/buscar?q=${encodeURIComponent(query)}`)
      if (!res.ok) {
        const d = await res.json().catch(() => null) as { message?: string } | null
        setErro(d?.message ?? 'Erro ao buscar')
        setResultados([])
        return
      }
      setResultados(await res.json())
      setBuscou(true)
    } catch {
      setErro('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={buscar} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#444]" />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="CPF, e-mail, nome, evento, ID do ingresso/pedido/pagamento..."
            className="w-full bg-[#111] border border-[#1e1e1e] rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-[#444] focus:outline-none focus:border-[#E8B84B]/40 transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !q.trim()}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-50 transition-opacity"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          Buscar
        </button>
      </form>

      {erro && (
        <p className="text-red-400 text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>
      )}

      {buscou && !loading && resultados.length === 0 && !erro && (
        <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Nenhum ingresso encontrado pra essa busca.
        </p>
      )}

      {resultados.length > 0 && (
        <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {resultados.length} ingresso{resultados.length !== 1 ? 's' : ''} encontrado{resultados.length !== 1 ? 's' : ''}
          {resultados.length === 100 && ' (limitado a 100 — refine a busca)'}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {resultados.map(r => {
          const statusInfo = ORDER_STATUS_LABEL[r.order_status] ?? { label: r.order_status, color: '#888' }
          return (
            <div
              key={r.ticket_id}
              className="rounded-2xl overflow-hidden"
              style={{ border: '1px solid #1a1a1a', background: '#0d0d0d' }}
            >
              {/* Cabeçalho: evento + status do pedido */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#141414]">
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-[#E8B84B]" />
                  <span className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-outfit)' }}>
                    {r.evento.titulo ?? 'Evento'}
                  </span>
                  {r.tipo_ingresso && (
                    <span className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      · {r.tipo_ingresso}
                    </span>
                  )}
                </div>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full"
                  style={{ color: statusInfo.color, background: `${statusInfo.color}15` }}
                >
                  {statusInfo.label}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-5 py-4">

                {/* Comprador */}
                <div className="flex flex-col gap-1">
                  <p className="text-[#444] text-[10px] font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    <User size={10} className="inline mr-1 -mt-0.5" /> Comprador
                  </p>
                  {r.comprador ? (
                    <>
                      <p className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>{r.comprador.nome ?? '—'}</p>
                      <p className="text-[#666] text-xs">{r.comprador.email}</p>
                      {r.comprador.cpf && <p className="text-[#666] text-xs">{fmtCPF(r.comprador.cpf)}</p>}
                      {r.comprador.telefone && <p className="text-[#666] text-xs">{r.comprador.telefone}</p>}
                    </>
                  ) : (
                    <p className="text-[#444] text-xs">Sem comprador vinculado</p>
                  )}
                </div>

                {/* Portador */}
                <div className="flex flex-col gap-1">
                  <p className="text-[#444] text-[10px] font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    <Ticket size={10} className="inline mr-1 -mt-0.5" /> Portador (slot {r.slot_number})
                  </p>
                  {r.portador ? (
                    <>
                      <p className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>{r.portador.nome ?? '—'}</p>
                      {r.portador.email && <p className="text-[#666] text-xs">{r.portador.email}</p>}
                      {r.portador.cpf && <p className="text-[#666] text-xs">{fmtCPF(r.portador.cpf)}</p>}
                      {r.portador.telefone && <p className="text-[#666] text-xs">{r.portador.telefone}</p>}
                    </>
                  ) : (
                    <p className="text-[#444] text-xs">Portador não preenchido</p>
                  )}
                </div>

                {/* Pagamento + validação */}
                <div className="flex flex-col gap-1">
                  <p className="text-[#444] text-[10px] font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    <CreditCard size={10} className="inline mr-1 -mt-0.5" /> Pagamento
                  </p>
                  <p className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>{fmtMoney(r.total)}</p>
                  <p className="text-[#666] text-xs">{r.gateway}{r.payment_method ? ` · ${r.payment_method}` : ''}</p>
                  <p className="text-[#666] text-xs">{fmtDate(r.order_created_at)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {r.validated_at ? (
                      <>
                        <CheckCircle2 size={11} className="text-green-400" />
                        <span className="text-green-400 text-[11px]">Validado {fmtDate(r.validated_at)}</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={11} className="text-[#444]" />
                        <span className="text-[#444] text-[11px]">Ainda não validado</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Rodapé: IDs técnicos, pra copiar/rastrear */}
              <div className="px-5 py-2.5 border-t border-[#141414] flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-[#333] text-[10px] font-mono">ingresso: {r.ticket_id}</span>
                <span className="text-[#333] text-[10px] font-mono">pedido: {r.order_id}</span>
                {r.mp_payment_id && <span className="text-[#333] text-[10px] font-mono">mp: {r.mp_payment_id}</span>}
                {r.pagbank_charge_id && <span className="text-[#333] text-[10px] font-mono">pagbank: {r.pagbank_charge_id}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
