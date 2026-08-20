'use client'

import { useState, useEffect } from 'react'
import { Ticket, Pencil, Check, X, Loader2, AlertTriangle, TrendingUp, Layers, Plus, Trash2, ChevronDown } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'

export type IngressoEditavel = {
  id:         string
  name:       string
  price:      number
  quantity:   number
  sold:       number
  eventDayId: string | null
}

interface DiaResumo {
  id:        string
  dayNumber: number
  date:      string
  startTime?: string
  endTime?:   string
}

interface Props {
  eventoId:          string
  ingressos:         IngressoEditavel[]
  capacity:          number | null
  dias?:             DiaResumo[]
  diaSelecionadoId?: string | null
  onUpdate:          (id: string, fields: Partial<IngressoEditavel>) => void
}

const ACCENT = '#E8B84B'

function formatPrice(v: number) {
  return v === 0 ? 'Gratuito' : `R$ ${v.toFixed(2).replace('.', ',')}`
}

// Mesmo fix de EventoPageClient.tsx — timeZone explícito evita descompasso
// servidor(UTC)/navegador(fuso do visitante) que quebrava a hidratação do
// React nas páginas de evento com ingressos.
function formatDateShort(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', '')
}

function formatTime(t?: string) {
  return t ? t.slice(0, 5) : ''
}

function formatDiaLabel(dia: DiaResumo) {
  const partes = [`Dia ${dia.dayNumber}`]
  if (dia.date) partes.push(formatDateShort(dia.date))
  const hora = formatTime(dia.startTime)
  const label = partes.join(' · ')
  if (!hora) return label
  const fim = formatTime(dia.endTime)
  return `${label} · ${hora}${fim ? ` – ${fim}` : ''}`
}

// ---------------------------------------------------------------------------
// Lote de ingresso (20/08/2026, pedido do usuário) — faixas de preço
// progressivas dentro do MESMO tipo de ingresso. Ver LotesService no
// backend: quem grava em EventTicket.price/quantity é sempre o backend
// (na hora da edição do lote, ou via cron a cada 10min pra pegar venda ou
// data de corte sem edição explícita) — aqui a gente só espelha a MESMA
// regra pra já mostrar o status de cada lote sem esperar o próximo tick.
// ---------------------------------------------------------------------------

type Lote = {
  id:        string
  ordem:     number
  price:     number | string
  quantity:  number
  dataCorte: string | null
}

// Mesma conversão de ModalAdiarEvento.tsx — ISO (UTC) pro formato que
// <input type="datetime-local"> espera (hora local do navegador).
function isoParaDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDataCorte(iso: string | null): string {
  if (!iso) return 'Sem data de corte'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

type StatusLote = 'ativo' | 'esgotado' | 'expirado' | 'aguardando'

// Espelha LotesService.resincronizar() do backend: primeiro lote, na ordem,
// que não esgotou por quantidade acumulada vendida nem passou da data de
// corte. Serve só pra status visual — quem manda no preço real é o backend.
function statusDosLotes(lotes: Lote[], vendidos: number): Map<string, StatusLote> {
  const agora = new Date()
  const status = new Map<string, StatusLote>()
  let acumulado = 0
  let jaAchouAtivo = false
  for (const lote of [...lotes].sort((a, b) => a.ordem - b.ordem)) {
    const expirou  = lote.dataCorte !== null && new Date(lote.dataCorte) <= agora
    const esgotou  = vendidos >= acumulado + lote.quantity
    if (expirou)      status.set(lote.id, 'expirado')
    else if (esgotou) status.set(lote.id, 'esgotado')
    else if (!jaAchouAtivo) { status.set(lote.id, 'ativo'); jaAchouAtivo = true }
    else               status.set(lote.id, 'aguardando')
    acumulado += lote.quantity
  }
  return status
}

const STATUS_LABEL: Record<StatusLote, { label: string; color: string }> = {
  ativo:      { label: 'Ativo agora',  color: '#4ade80' },
  aguardando: { label: 'Na fila',      color: '#555' },
  esgotado:   { label: 'Esgotado',     color: '#f87171' },
  expirado:   { label: 'Expirado',     color: '#f87171' },
}

function LoteFormRow({ inicial, onSalvar, onCancelar }: {
  inicial:    { price: string; quantity: string; dataCorte: string }
  onSalvar:   (v: { price: number; quantity: number; dataCorte: string | null }) => Promise<void>
  onCancelar: () => void
}) {
  const [price, setPrice]       = useState(inicial.price)
  const [quantity, setQuantity] = useState(inicial.quantity)
  const [dataCorte, setDataCorte] = useState(inicial.dataCorte)
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState<string | null>(null)

  async function salvar() {
    const p = Number(price.replace(',', '.'))
    const q = parseInt(quantity, 10)
    if (isNaN(p) || p < 0) { setErr('Preço inválido'); return }
    if (isNaN(q) || q <= 0) { setErr('Quantidade precisa ser maior que zero'); return }
    setSaving(true); setErr(null)
    try {
      await onSalvar({ price: p, quantity: q, dataCorte: dataCorte ? new Date(dataCorte).toISOString() : null })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar lote')
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: '#111', border: `1px solid ${ACCENT}30` }}>
      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-[#444] text-[10px] mb-1 uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>Preço</p>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555] text-xs">R$</span>
            <input
              type="number" value={price} onChange={e => setPrice(e.target.value)}
              min="0" step="0.01" placeholder="0,00"
              className="w-full bg-[#0d0d0d] border border-[#222] rounded-lg pl-7 pr-2 py-1.5 text-white text-xs outline-none focus:border-[#E8B84B]/40"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
          </div>
        </div>
        <div className="flex-1">
          <p className="text-[#444] text-[10px] mb-1 uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>Quantidade</p>
          <input
            type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
            min="1" placeholder="0"
            className="w-full bg-[#0d0d0d] border border-[#222] rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-[#E8B84B]/40"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          />
        </div>
      </div>
      <div>
        <p className="text-[#444] text-[10px] mb-1 uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Data de corte (opcional)
        </p>
        <input
          type="datetime-local" value={dataCorte} onChange={e => setDataCorte(e.target.value)}
          className="w-full bg-[#0d0d0d] border border-[#222] rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-[#E8B84B]/40"
          style={{ fontFamily: 'var(--font-dm-sans)', colorScheme: 'dark' }}
        />
      </div>
      {err && (
        <div className="flex items-center gap-1.5 text-red-400 text-[11px] py-1.5 px-2 rounded-lg bg-red-400/5">
          <AlertTriangle size={11} className="shrink-0" /> {err}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onCancelar}
          className="flex-1 py-1.5 rounded-lg text-[11px] text-[#444] border border-[#1e1e1e] hover:text-white hover:border-[#333] transition-colors"
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Cancelar
        </button>
        <button type="button" onClick={salvar} disabled={saving}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold text-[#070707] disabled:opacity-60"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

function LotesSection({ ticketId, vendidos, onSincronizado, onTemLotes }: {
  ticketId:       string
  vendidos:       number
  onSincronizado: (fields: { price: number; quantity: number }) => void
  onTemLotes:     (temLotes: boolean) => void
}) {
  const [lotes, setLotes]         = useState<Lote[] | null>(null)
  const [aberto, setAberto]       = useState(false)
  const [criando, setCriando]     = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [err, setErr]             = useState<string | null>(null)

  async function carregar() {
    const res = await apiFetchAuth(`/api/ingressos/${ticketId}/lotes`)
    if (!res.ok) { setErr('Erro ao carregar lotes'); return }
    const data = await res.json() as Lote[]
    setLotes(data)
    onTemLotes(data.length > 0)
  }

  // Carrega uma vez ao montar, mesmo colapsado — assim o card já sabe se
  // esse ingresso tem lote (pra travar a edição direta de preço/quantidade)
  // sem precisar o usuário abrir a seção primeiro.
  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  function notificarSync(novosLotes: Lote[]) {
    if (novosLotes.length === 0) return
    const status = statusDosLotes(novosLotes, vendidos)
    const ativo = novosLotes.find(l => status.get(l.id) === 'ativo') ?? novosLotes[novosLotes.length - 1]
    const quantityTotal = novosLotes.reduce((s, l) => s + l.quantity, 0)
    onSincronizado({ price: Number(ativo.price), quantity: quantityTotal })
  }

  async function criar(v: { price: number; quantity: number; dataCorte: string | null }) {
    const res = await apiFetchAuth(`/api/ingressos/${ticketId}/lotes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v),
    })
    if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d?.error ?? 'Erro ao criar lote') }
    await carregar()
    setCriando(false)
  }

  async function atualizar(loteId: string, v: { price: number; quantity: number; dataCorte: string | null }) {
    const res = await apiFetchAuth(`/api/ingressos/lotes/${loteId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v),
    })
    if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d?.error ?? 'Erro ao editar lote') }
    await carregar()
    setEditandoId(null)
  }

  async function excluir(loteId: string) {
    setErr(null)
    const res = await apiFetchAuth(`/api/ingressos/lotes/${loteId}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json().catch(() => null); setErr(d?.error ?? 'Erro ao excluir lote'); return }
    await carregar()
  }

  // Sempre que a lista recarrega, avisa o card pra atualizar o preço/total
  // exibidos (o backend já resincronizou EventTicket.price/quantity nessa
  // mesma chamada de criar/editar/excluir — aqui só espelha o resultado).
  useEffect(() => {
    if (lotes) notificarSync(lotes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotes])

  const status = lotes ? statusDosLotes(lotes, vendidos) : new Map()

  return (
    <div className="px-4 pb-4">
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#111] transition-colors"
      >
        <span className="flex items-center gap-1.5 text-[#888] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <Layers size={12} />
          Lotes de preço{lotes && lotes.length > 0 ? ` (${lotes.length})` : ''}
        </span>
        <ChevronDown size={13} className="text-[#444] transition-transform" style={{ transform: aberto ? 'rotate(180deg)' : 'none' }} />
      </button>

      {aberto && (
        <div className="flex flex-col gap-2 mt-1 px-1">
          {lotes === null ? (
            <p className="text-[#444] text-xs px-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>Carregando...</p>
          ) : (
            <>
              {lotes.length === 0 && !criando && (
                <p className="text-[#444] text-xs px-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Sem lotes — preço e quantidade seguem fixos, editáveis direto ali em cima.
                </p>
              )}
              {[...lotes].sort((a, b) => a.ordem - b.ordem).map(lote => {
                const st = status.get(lote.id) as StatusLote
                if (editandoId === lote.id) {
                  return (
                    <LoteFormRow
                      key={lote.id}
                      inicial={{ price: String(lote.price), quantity: String(lote.quantity), dataCorte: isoParaDatetimeLocal(lote.dataCorte) }}
                      onSalvar={v => atualizar(lote.id, v)}
                      onCancelar={() => setEditandoId(null)}
                    />
                  )
                }
                return (
                  <div key={lote.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#111' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-xs font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          {formatPrice(Number(lote.price))} · {lote.quantity} un
                        </span>
                        <span className="text-[10px] font-medium" style={{ color: STATUS_LABEL[st]?.color ?? '#555', fontFamily: 'var(--font-dm-sans)' }}>
                          {STATUS_LABEL[st]?.label ?? ''}
                        </span>
                      </div>
                      <p className="text-[#555] text-[10px] mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {formatDataCorte(lote.dataCorte)}
                      </p>
                    </div>
                    <button type="button" onClick={() => setEditandoId(lote.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#1a1a1a] transition-colors shrink-0">
                      <Pencil size={11} className="text-[#444] hover:text-white" />
                    </button>
                    <button type="button" onClick={() => excluir(lote.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-400/10 transition-colors shrink-0">
                      <Trash2 size={11} className="text-[#444] hover:text-red-400" />
                    </button>
                  </div>
                )
              })}
              {err && (
                <div className="flex items-center gap-1.5 text-red-400 text-[11px] py-1.5 px-2 rounded-lg bg-red-400/5">
                  <AlertTriangle size={11} className="shrink-0" /> {err}
                </div>
              )}
              {criando ? (
                <LoteFormRow
                  inicial={{ price: '', quantity: '', dataCorte: '' }}
                  onSalvar={criar}
                  onCancelar={() => setCriando(false)}
                />
              ) : (
                <button type="button" onClick={() => setCriando(true)}
                  className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                  style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}30`, color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                  <Plus size={11} /> Adicionar lote
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card de ingresso editável
// ---------------------------------------------------------------------------

function IngressoCard({
  ingresso,
  capacidadeDisponivel,
  onSave,
  onLotesSincronizados,
}: {
  ingresso:             IngressoEditavel
  capacidadeDisponivel: number | null
  onSave:               (fields: { name?: string; price?: number; quantity?: number }) => Promise<void>
  onLotesSincronizados: (fields: { price: number; quantity: number }) => void
}) {
  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState<string | null>(null)
  const [name,     setName]     = useState(ingresso.name)
  const [price,    setPrice]    = useState(String(ingresso.price))
  const [quantity, setQuantity] = useState(String(ingresso.quantity))
  // Uma vez que o ingresso tem lote, preço/quantidade viram derivados dos
  // lotes (ver ingressos.service.ts > atualizar() no backend, que já
  // bloqueia essa edição direta) — aqui só evita deixar o usuário tentar
  // uma edição que vai voltar com erro.
  const [temLotes, setTemLotes] = useState(false)

  const disponivel  = ingresso.quantity - ingresso.sold
  const pctVendido  = ingresso.quantity > 0 ? Math.round((ingresso.sold / ingresso.quantity) * 100) : 0
  const maxQuantity = capacidadeDisponivel !== null
    ? ingresso.quantity + capacidadeDisponivel   // pode aumentar até a sobra da capacidade
    : undefined

  function cancelar() {
    setEditing(false)
    setErr(null)
    setName(ingresso.name)
    setPrice(String(ingresso.price))
    setQuantity(String(ingresso.quantity))
  }

  async function salvar() {
    if (!name.trim()) { setErr('Nome obrigatório'); return }

    // Com lote configurado, o backend rejeita price/quantity direto —
    // manda só o nome (ver comentário no useState de temLotes acima).
    if (temLotes) {
      setSaving(true); setErr(null)
      try {
        await onSave({ name: name.trim() })
        setEditing(false)
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Erro ao salvar')
      } finally {
        setSaving(false)
      }
      return
    }

    const newQty   = parseInt(quantity, 10)
    const newPrice = parseFloat(price.replace(',', '.'))

    if (isNaN(newQty)   || newQty   < 0) { setErr('Quantidade inválida');  return }
    if (isNaN(newPrice) || newPrice < 0) { setErr('Preço inválido');        return }
    if (newQty < ingresso.sold)          {
      setErr(`Mínimo é ${ingresso.sold} (já vendidos)`)
      return
    }

    setSaving(true)
    setErr(null)
    try {
      await onSave({
        name:     name.trim(),
        price:    newPrice,
        quantity: newQty,
      })
      setEditing(false)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: editing ? `1px solid ${ACCENT}40` : '1px solid #1a1a1a', background: '#0d0d0d' }}
    >
      {/* Cabeçalho */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-[#E8B84B]/40"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
              placeholder="Nome do ingresso"
            />
          ) : (
            <p className="text-white text-sm font-semibold truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {ingresso.name}
            </p>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#1a1a1a] transition-colors shrink-0"
          >
            <Pencil size={13} className="text-[#444] hover:text-white" />
          </button>
        )}
      </div>

      {/* Barra de progresso de vendas */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[#555] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {ingresso.sold} vendidos · {disponivel} disponíveis
          </span>
          <span className="text-[#555] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {pctVendido}%
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width:      `${pctVendido}%`,
              background: pctVendido >= 90 ? '#f87171' : pctVendido >= 60 ? ACCENT : '#4ade80',
            }}
          />
        </div>
      </div>

      {/* Preço e quantidade (edição inline) */}
      <div className="px-4 pb-4 flex gap-3 items-end">
        <div className="flex-1">
          <p className="text-[#444] text-[10px] mb-1 uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Preço
          </p>
          {editing && !temLotes ? (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555] text-sm">R$</span>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                min="0"
                step="0.01"
                className="w-full bg-[#111] border border-[#222] rounded-lg pl-8 pr-3 py-2 text-white text-sm outline-none focus:border-[#E8B84B]/40"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
            </div>
          ) : (
            <p className="text-sm font-semibold" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
              {formatPrice(ingresso.price)}
            </p>
          )}
          {editing && !temLotes && ingresso.sold > 0 && (
            <p className="text-[#555] text-[10px] mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Aplica só às vendas futuras
            </p>
          )}
          {editing && temLotes && (
            <p className="text-[#555] text-[10px] mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Controlado pelos lotes abaixo
            </p>
          )}
        </div>

        <div className="flex-1">
          <p className="text-[#444] text-[10px] mb-1 uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Total
          </p>
          {editing && !temLotes ? (
            <div>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                min={ingresso.sold}
                max={maxQuantity}
                className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#E8B84B]/40"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
              <p className="text-[#444] text-[10px] mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Mín. {ingresso.sold}
                {maxQuantity !== undefined && ` · Máx. ${maxQuantity}`}
              </p>
            </div>
          ) : (
            <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {ingresso.quantity} ingressos
            </p>
          )}
        </div>
      </div>

      {/* Lotes de preço (20/08/2026) */}
      <LotesSection
        ticketId={ingresso.id}
        vendidos={ingresso.sold}
        onTemLotes={setTemLotes}
        onSincronizado={onLotesSincronizados}
      />

      {/* Botões de edição */}
      {editing && (
        <div className="px-4 pb-4 flex flex-col gap-2">
          {err && (
            <div className="flex items-center gap-2 text-red-400 text-xs py-2 px-3 rounded-lg bg-red-400/5">
              <AlertTriangle size={12} className="shrink-0" />
              {err}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancelar}
              className="flex-1 py-2 rounded-xl text-xs text-[#444] border border-[#1e1e1e] hover:text-white hover:border-[#333] transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-[#070707] disabled:opacity-60"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Novo tipo de ingresso (20/08/2026, pedido do usuário) — nome, preço,
// quantidade. Sem eventDayId aqui: o painel principal já resolve isso (dia
// selecionado na Programação, ou null se o evento não tem dias/é pacote).
// ---------------------------------------------------------------------------

function NovoIngressoForm({ onSalvar, onCancelar, capacidadeDisponivel, ingressosExistentes }: {
  onSalvar:   (novo: { name: string; price: number; quantity: number }, transferir?: { deId: string; qtd: number }) => Promise<void>
  onCancelar: () => void
  // null = evento sem capacidade fixa, não precisa validar nada.
  capacidadeDisponivel: number | null
  ingressosExistentes:  IngressoEditavel[]
}) {
  const [name, setName]         = useState('')
  const [price, setPrice]       = useState('')
  const [quantity, setQuantity] = useState('')
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState<string | null>(null)
  // Achado real (20/08/2026, usuário testando): quando a capacidade do
  // evento já está toda alocada, criar um tipo novo precisa tirar vaga de
  // outro — sem isso, ou o form travava sem explicar por quê, ou deixava
  // passar do total sem avisar.
  const [transferirDeId, setTransferirDeId] = useState('')

  const qtdNum = parseInt(quantity, 10) || 0
  const faltam = capacidadeDisponivel !== null ? Math.max(0, qtdNum - capacidadeDisponivel) : 0
  const origem = ingressosExistentes.find(t => t.id === transferirDeId)
  const disponivelNaOrigem = origem ? origem.quantity - origem.sold : 0

  async function salvar() {
    if (!name.trim()) { setErr('Dá um nome pro tipo de ingresso (ex: Pista, VIP, Camarote)'); return }
    if (qtdNum <= 0) { setErr('Quantidade precisa ser maior que zero'); return }

    let transferir: { deId: string; qtd: number } | undefined
    if (faltam > 0) {
      if (!origem) { setErr(`Faltam ${faltam} vaga(s) — escolha de qual ingresso tirar.`); return }
      if (faltam > disponivelNaOrigem) {
        setErr(`"${origem.name}" só tem ${disponivelNaOrigem} vaga(s) sem venda pra ceder — escolha outro ou reduza a quantidade.`)
        return
      }
      transferir = { deId: origem.id, qtd: faltam }
    }

    setSaving(true); setErr(null)
    try {
      const precoNum = Number(price.replace(',', '.')) || 0
      await onSalvar({ name: name.trim(), price: precoNum, quantity: qtdNum }, transferir)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao criar ingresso')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: '#0d0d0d', border: `1px solid ${ACCENT}40` }}>
      <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>Novo tipo de ingresso</p>
      <input
        value={name} onChange={e => setName(e.target.value)}
        placeholder="Nome (ex: Pista, VIP, Camarote)" autoFocus
        className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#E8B84B]/40"
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      />
      <div className="flex gap-3">
        <div className="flex-1">
          <p className="text-[#444] text-[10px] mb-1 uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>Preço</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555] text-sm">R$</span>
            <input
              type="number" value={price} onChange={e => setPrice(e.target.value)}
              min="0" step="0.01" placeholder="0,00"
              className="w-full bg-[#111] border border-[#222] rounded-lg pl-8 pr-3 py-2 text-white text-sm outline-none focus:border-[#E8B84B]/40"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
          </div>
        </div>
        <div className="flex-1">
          <p className="text-[#444] text-[10px] mb-1 uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>Quantidade</p>
          <input
            type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
            min="1" placeholder="0"
            className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#E8B84B]/40"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          />
          {capacidadeDisponivel !== null && (
            <p className="text-[#444] text-[10px] mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {capacidadeDisponivel} vaga(s) livre(s) no evento
            </p>
          )}
        </div>
      </div>

      {faltam > 0 && (
        <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'rgba(232,184,75,0.06)', border: `1px solid ${ACCENT}30` }}>
          <p className="text-xs" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
            Faltam {faltam} vaga(s) — de qual ingresso quer tirar?
          </p>
          <select
            value={transferirDeId} onChange={e => setTransferirDeId(e.target.value)}
            className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#E8B84B]/40"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            <option value="">Selecione...</option>
            {ingressosExistentes.map(t => (
              <option key={t.id} value={t.id}>{t.name} — {t.quantity - t.sold} livre(s)</option>
            ))}
          </select>
          {origem && (
            <p className="text-[#888] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              &quot;{origem.name}&quot; vai de {origem.quantity} pra {origem.quantity - faltam}
            </p>
          )}
        </div>
      )}

      {err && (
        <div className="flex items-center gap-2 text-red-400 text-xs py-2 px-3 rounded-lg bg-red-400/5">
          <AlertTriangle size={12} className="shrink-0" /> {err}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onCancelar}
          className="flex-1 py-2 rounded-xl text-xs text-[#444] border border-[#1e1e1e] hover:text-white hover:border-[#333] transition-colors"
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Cancelar
        </button>
        <button type="button" onClick={salvar} disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-[#070707] disabled:opacity-60"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {saving ? 'Criando...' : 'Criar ingresso'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Painel principal
// ---------------------------------------------------------------------------

export function PainelIngressos({ eventoId, ingressos, capacity, dias, diaSelecionadoId, onUpdate }: Props) {
  const [localIngressos, setLocalIngressos] = useState(ingressos)
  const [criando, setCriando] = useState(false)

  // Mostra a info do dia sempre que o show tiver algum dia (mesmo só 1 —
  // caso comum de Tenda), não só quando há vários dias
  const temDias = (dias?.length ?? 0) >= 1
  const pacote  = localIngressos.filter(t => t.eventDayId === null)
  // Segue o mesmo dia selecionado na Programação — evita empilhar todos os
  // dias aqui quando o usuário já escolheu qual dia está olhando
  const diaAtual     = temDias ? (dias ?? []).find(d => d.id === diaSelecionadoId) ?? null : null
  const ticketsDoDia = diaAtual ? localIngressos.filter(t => t.eventDayId === diaAtual.id) : []

  const totalEmUso = localIngressos.reduce((sum, t) => sum + t.quantity, 0)
  const totalVendido = localIngressos.reduce((sum, t) => sum + t.sold, 0)
  const capacidadePct = capacity ? Math.round((totalEmUso / capacity) * 100) : null

  async function handleSave(ticketId: string, fields: { name?: string; price?: number; quantity?: number }) {
    const res = await apiFetchAuth(`/api/ingressos/${ticketId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error ?? 'Erro ao salvar')
    }
    setLocalIngressos(prev =>
      prev.map(t => t.id === ticketId ? { ...t, ...fields } : t)
    )
    onUpdate(ticketId, fields)
  }

  // Criar um TIPO novo de ingresso (Pista, VIP, Camarote...) — não é editar
  // quantidade de um que já existe. Achado real (20/08/2026, usuário
  // testando o painel novo): não tinha nenhum jeito disso ficar direto
  // aqui — só existia o assistente antigo, fora do painel. Reaproveita o
  // mesmo endpoint que o assistente usa (POST /eventos/:id/dias): mandar
  // só o ingresso novo, sem id, não mexe nos que já existem (confirmado no
  // backend antes de fazer isso — sem id = create, com id = update, o resto
  // da lista simplesmente não é tocado).
  //
  // transferir (opcional, pedido do usuário 20/08/2026): quando a
  // capacidade do evento já está toda alocada, criar um tipo novo exige
  // tirar vaga de outro — manda os dois no MESMO POST (o existente com
  // quantity reduzida, o novo sem id), então é uma operação atômica, não
  // duas chamadas separadas que podiam deixar o total inconsistente se a
  // segunda falhasse.
  async function handleCriar(
    novo: { name: string; price: number; quantity: number },
    transferir?: { deId: string; qtd: number },
  ) {
    const eventDayId = temDias ? (diaAtual?.id ?? null) : null
    const ingressosPayload: Array<{ id?: string; name: string; price: number; quantity: number; eventDayId: string | null }> = [
      { ...novo, eventDayId },
    ]
    let origem: IngressoEditavel | undefined
    if (transferir) {
      origem = localIngressos.find(t => t.id === transferir.deId)
      if (origem) {
        ingressosPayload.push({
          id: origem.id, name: origem.name, price: origem.price,
          quantity: origem.quantity - transferir.qtd, eventDayId: origem.eventDayId,
        })
      }
    }

    const res = await apiFetchAuth(`/api/eventos/${eventoId}/dias`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ingressos: ingressosPayload }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => null) as { error?: string } | null
      throw new Error(d?.error ?? 'Erro ao criar ingresso')
    }
    const data = await res.json() as { ingressos: { index: number; id: string; eventDayId: string | null }[] }
    const criado = data.ingressos[0]
    setLocalIngressos(prev => {
      const atualizados = origem && transferir
        ? prev.map(t => t.id === origem!.id ? { ...t, quantity: origem!.quantity - transferir.qtd } : t)
        : prev
      return [...atualizados, { id: criado.id, ...novo, sold: 0, eventDayId: criado.eventDayId }]
    })
    setCriando(false)
  }

  return (
    <div className="flex flex-col gap-4">

      {criando ? (
        <NovoIngressoForm
          onSalvar={handleCriar}
          onCancelar={() => setCriando(false)}
          capacidadeDisponivel={capacity !== null ? capacity - totalEmUso : null}
          ingressosExistentes={localIngressos}
        />
      ) : (
        <button
          type="button"
          onClick={() => setCriando(true)}
          className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}40`, color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
        >
          + Adicionar tipo de ingresso
        </button>
      )}

      {/* Resumo de capacidade */}
      {capacity && (
        <div className="rounded-2xl p-4" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} style={{ color: ACCENT }} />
            <span className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-outfit)' }}>
              Capacidade do evento
            </span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {totalEmUso} alocados · {capacity - totalEmUso} disponíveis
            </span>
            <span className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {totalVendido} vendidos
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#1a1a1a] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width:      `${capacidadePct}%`,
                background: ACCENT,
              }}
            />
          </div>
          <p className="text-[#444] text-[10px] mt-1.5 text-right" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {totalEmUso} / {capacity} slots alocados
          </p>
        </div>
      )}

      {/* Lista de tipos de ingresso */}
      {localIngressos.length === 0 ? (
        <div className="text-center py-8">
          <Ticket size={24} className="text-[#333] mx-auto mb-2" />
          <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Nenhum tipo de ingresso cadastrado.
          </p>
          <a
            href={`/criar-evento/${eventoId}/ingressos`}
            className="inline-flex items-center gap-1.5 mt-3 text-xs text-[#E8B84B] hover:underline"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Gerenciar ingressos →
          </a>
        </div>
      ) : temDias ? (
        <div className="flex flex-col gap-5">
          {diaAtual && (
            <div className="flex flex-col gap-3">
              <p className="text-[#555] text-[11px] font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {formatDiaLabel(diaAtual)}
              </p>
              {ticketsDoDia.length > 0
                ? ticketsDoDia.map(ingresso => renderCard(ingresso))
                : <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Nenhum ingresso cadastrado para este dia.
                  </p>
              }
            </div>
          )}
          {pacote.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[#555] text-[11px] font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Pacote completo
              </p>
              {pacote.map(ingresso => renderCard(ingresso))}
            </div>
          )}
        </div>
      ) : (
        localIngressos.map(ingresso => renderCard(ingresso))
      )}
    </div>
  )

  function renderCard(ingresso: IngressoEditavel) {
    // Capacidade disponível para este ingresso = sobra da capacidade total
    const somaOutros = localIngressos
      .filter(t => t.id !== ingresso.id)
      .reduce((sum, t) => sum + t.quantity, 0)
    const capacidadeDisponivel = capacity !== null ? capacity - somaOutros - ingresso.quantity : null

    return (
      <IngressoCard
        key={ingresso.id}
        ingresso={ingresso}
        capacidadeDisponivel={capacidadeDisponivel}
        onSave={fields => handleSave(ingresso.id, fields)}
        onLotesSincronizados={fields => {
          // O backend já gravou isso em EventTicket.price/quantity na
          // hora de criar/editar/excluir o lote — aqui só espelha pra
          // atualizar a tela sem precisar de round-trip extra.
          setLocalIngressos(prev => prev.map(t => t.id === ingresso.id ? { ...t, ...fields } : t))
          onUpdate(ingresso.id, fields)
        }}
      />
    )
  }
}
