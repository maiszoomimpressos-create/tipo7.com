'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Package, Layers, Plus, Trash2, Loader2,
  Ticket, ArrowRight, Check, ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface Attraction { id?: string; name: string; description: string; order_index: number; scheduled_time?: string }
interface DiaConfig {
  id?:         string
  day_number:  number
  date:        string
  start_time:  string
  end_time:    string
  attractions: Attraction[]
}
interface IngressoConfig {
  id?:          string
  event_day_id: string | null   // null = pacote
  name:         string
  description:  string
  price:        number
  quantity:     number
  order_index:  number
}

interface Props {
  eventoId:              string
  numDias:               number
  dateStart:             string
  dateEnd:               string
  ticketModeInicial:     'individual' | 'pacote' | 'ambos' | null
  packageDiscountInicial: number
  diasIniciais:          DiaConfig[]
  ingressosIniciais:     IngressoConfig[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]'
const labelCls = 'text-[#666] text-[11px] font-medium tracking-widest uppercase'
const selectCls = 'bg-[#111] border border-[#222] rounded-xl px-3 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 appearance-none cursor-pointer'

function extractTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`
}

function TimeInput24h({ value, onChange, compact }: { value: string; onChange: (v: string) => void; compact?: boolean }) {
  const parts = value ? value.split(':') : ['00','00']
  const hh = parts[0] ?? '00'
  const mm = parts[1]?.slice(0,2) ?? '00'
  const emit = (h: string, m: string) => onChange(`${h.padStart(2,'0')}:${m.padStart(2,'0')}`)

  const cls = compact
    ? 'bg-[#111] border border-[#222] rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-[#E8B84B]/40 appearance-none cursor-pointer'
    : selectCls

  return (
    <div className="flex gap-2">
      <select value={hh} onChange={e => emit(e.target.value, mm)}
        className={cn(cls, compact ? 'w-16' : 'flex-1')}
        style={{ fontFamily: 'var(--font-dm-sans)' }}>
        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2,'0')).map(h => (
          <option key={h} value={h}>{h}h</option>
        ))}
      </select>
      <select value={mm} onChange={e => emit(hh, e.target.value)}
        className={cn(cls, compact ? 'w-20' : 'flex-1')}
        style={{ fontFamily: 'var(--font-dm-sans)' }}>
        {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => (
          <option key={m} value={m}>{m}min</option>
        ))}
      </select>
    </div>
  )
}

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const gerarDatas = (dateStart: string, numDias: number): string[] => {
  const datas: string[] = []
  const base = new Date(dateStart)
  for (let i = 0; i < numDias; i++) {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    datas.push(d.toISOString().slice(0, 10))
  }
  return datas
}

const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const formatData = (iso: string) => {
  const d = new Date(iso + 'T12:00:00')
  return `${DIAS_PT[d.getDay()]}, ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
}

const SUGESTOES_INGRESSO = ['Pista', 'VIP', 'Camarote', 'Meia-entrada', 'Gratuito']

// ─── Sub-componente de ingressos por dia/pacote ───────────────────────────────
// Definido FORA do componente pai para evitar remount a cada render (bug de foco)

interface IngressosPorDiaProps {
  dayId:          string | null
  label:          string
  ingressos:      IngressoConfig[]
  onUpdate:       (idx: number, patch: Partial<IngressoConfig>) => void
  onRemove:       (idx: number) => void
  onAdd:          (dayId: string | null) => void
  onAddSugestao:  (dayId: string | null, nome: string) => void
}

function IngressosPorDia({ dayId, label, ingressos, onUpdate, onRemove, onAdd, onAddSugestao }: IngressosPorDiaProps) {
  const lista = ingressos
    .map((t, i) => ({ ...t, idx: i }))
    .filter(t => t.event_day_id === dayId)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Ingressos — {label}</span>
        <div className="flex gap-2 flex-wrap">
          {SUGESTOES_INGRESSO.map(s => (
            <button key={s} type="button"
              onClick={() => onAddSugestao(dayId, s)}
              className="text-[10px] px-2 py-1 rounded-lg border border-[#222] text-[#444] hover:border-[#E8B84B]/40 hover:text-[#E8B84B] transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>
              + {s}
            </button>
          ))}
        </div>
      </div>

      {lista.map(t => (
        <div key={t.idx} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex gap-2">
            <input type="text" placeholder="Nome do ingresso *" value={t.name}
              onChange={e => onUpdate(t.idx, { name: e.target.value })}
              className={cn(inputCls, 'flex-1')} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            <button type="button" onClick={() => onRemove(t.idx)}
              className="text-[#2a2a2a] hover:text-red-500 transition-colors px-2">
              <Trash2 size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] text-sm">R$</span>
              <input type="number" min="0" step="0.01" placeholder="0,00" value={t.price || ''}
                onChange={e => onUpdate(t.idx, { price: parseFloat(e.target.value) || 0 })}
                className={cn(inputCls, 'pl-9')} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
            <div className="relative">
              <input type="number" min="0" step="1" placeholder="Qtd" value={t.quantity || ''}
                onChange={e => onUpdate(t.idx, { quantity: parseInt(e.target.value) || 0 })}
                className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
          </div>
          {(t.price > 0 || t.quantity > 0) && (
            <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {t.quantity > 0 && `${t.quantity} unidades`}
              {t.price > 0 && t.quantity > 0 && ' · '}
              {t.price > 0 && formatBRL(t.price)}
              {t.price > 0 && t.quantity > 0 && ` · Total potencial: ${formatBRL(t.price * t.quantity)}`}
            </p>
          )}
        </div>
      ))}

      <button type="button" onClick={() => onAdd(dayId)}
        className="flex items-center gap-2 text-[#444] hover:text-[#E8B84B] text-xs transition-colors py-2"
        style={{ fontFamily: 'var(--font-dm-sans)' }}>
        <Plus size={13} /> Adicionar tipo de ingresso
      </button>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function IngressosClient({
  eventoId,
  numDias,
  dateStart,
  dateEnd,
  ticketModeInicial,
  packageDiscountInicial,
  diasIniciais,
  ingressosIniciais,
}: Props) {
  const router   = useRouter()
  const supabase = createClient()

  const isMultiDay = numDias > 1

  const [ticketMode, setTicketMode] = useState<'individual' | 'pacote' | 'ambos' | null>(
    ticketModeInicial ?? (isMultiDay ? null : 'individual')
  )
  const [packageDiscount, setPackageDiscount] = useState(packageDiscountInicial)

  const datas = gerarDatas(dateStart, numDias)
  const [dias, setDias] = useState<DiaConfig[]>(() => {
    if (diasIniciais.length > 0) return diasIniciais
    const defaultStart = extractTime(dateStart)
    const defaultEnd   = extractTime(dateEnd)
    return datas.map((date, i) => ({
      day_number:  i + 1,
      date,
      start_time:  defaultStart,
      end_time:    defaultEnd,
      attractions: [],
    }))
  })
  const [diaAberto,  setDiaAberto]  = useState<number>(1)
  const [duracaoDia, setDuracaoDia] = useState<Record<number, string>>({})

  const [ingressos, setIngressos] = useState<IngressoConfig[]>(ingressosIniciais)

  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [erro,   setErro]   = useState<string | null>(null)

  // ─── Helpers de estado ───────────────────────────────────────────────────────

  const updateDia = (dayNumber: number, patch: Partial<DiaConfig>) =>
    setDias(prev => prev.map(d => d.day_number === dayNumber ? { ...d, ...patch } : d))

  const calcEndTime = (startTime: string, horas: string): string => {
    if (!startTime || !horas || isNaN(parseFloat(horas))) return ''
    const [h, m]   = startTime.split(':').map(Number)
    const totalMin = h * 60 + m + Math.round(parseFloat(horas) * 60)
    const endH     = Math.floor(totalMin / 60) % 24
    const endM     = totalMin % 60
    return `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`
  }

  const handleDuracaoDia = (dayNumber: number, horas: string, startTime: string) => {
    setDuracaoDia(prev => ({ ...prev, [dayNumber]: horas }))
    const endTime = calcEndTime(startTime, horas)
    if (endTime) updateDia(dayNumber, { end_time: endTime })
  }

  const handleStartTimeDia = (dayNumber: number, startTime: string) => {
    updateDia(dayNumber, { start_time: startTime })
    const dur = duracaoDia[dayNumber]
    if (dur && startTime) {
      const endTime = calcEndTime(startTime, dur)
      if (endTime) updateDia(dayNumber, { start_time: startTime, end_time: endTime })
    }
  }

  const addAttraction = (dayNumber: number) =>
    updateDia(dayNumber, {
      attractions: [
        ...(dias.find(d => d.day_number === dayNumber)?.attractions ?? []),
        { name: '', description: '', order_index: Date.now() },
      ],
    })

  const updateAttraction = (dayNumber: number, idx: number, patch: Partial<Attraction>) =>
    setDias(prev => prev.map(d => {
      if (d.day_number !== dayNumber) return d
      const arr = [...d.attractions]
      arr[idx] = { ...arr[idx], ...patch }
      return { ...d, attractions: arr }
    }))

  const removeAttraction = (dayNumber: number, idx: number) =>
    setDias(prev => prev.map(d => {
      if (d.day_number !== dayNumber) return d
      return { ...d, attractions: d.attractions.filter((_, i) => i !== idx) }
    }))

  const addIngresso = (eventDayId: string | null) =>
    setIngressos(prev => [...prev, {
      event_day_id: eventDayId,
      name:         '',
      description:  '',
      price:        0,
      quantity:     0,
      order_index:  prev.filter(t => t.event_day_id === eventDayId).length,
    }])

  const updateIngresso = (idx: number, patch: Partial<IngressoConfig>) =>
    setIngressos(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t))

  const removeIngresso = (idx: number) =>
    setIngressos(prev => prev.filter((_, i) => i !== idx))

  const addIngressoSugestao = (dayId: string | null, nome: string) =>
    setIngressos(prev => [...prev, {
      event_day_id: dayId,
      name:         nome,
      description:  '',
      price:        0,
      quantity:     0,
      order_index:  prev.filter(t => t.event_day_id === dayId).length,
    }])

  // ─── Salvar tudo ─────────────────────────────────────────────────────────────

  const handleSalvar = async (continuar = false) => {
    setSaving(true); setErro(null)
    try {
      await supabase.from('events').update({
        ticket_mode:          ticketMode,
        package_discount_pct: packageDiscount,
      }).eq('id', eventoId)

      if (ticketMode !== 'pacote') {
        for (const dia of dias) {
          const { data: diaDb } = dia.id
            ? await supabase.from('event_days').upsert({
                id:         dia.id,
                event_id:   eventoId,
                day_number: dia.day_number,
                date:       dia.date,
                start_time: dia.start_time || null,
                end_time:   dia.end_time   || null,
              }).select('id').single()
            : await supabase.from('event_days').upsert({
                event_id:   eventoId,
                day_number: dia.day_number,
                date:       dia.date,
                start_time: dia.start_time || null,
                end_time:   dia.end_time   || null,
              }, { onConflict: 'event_id,day_number' }).select('id').single()

          if (!diaDb) continue
          const diaId = diaDb.id

          await supabase.from('event_day_attractions').delete().eq('event_day_id', diaId)
          const atracoes = dia.attractions.filter(a => a.name.trim())
          if (atracoes.length > 0) {
            await supabase.from('event_day_attractions').insert(
              atracoes.map((a, i) => ({
                event_day_id:   diaId,
                name:           a.name.trim(),
                description:    a.description || null,
                order_index:    i,
                scheduled_time: a.scheduled_time || null,
              }))
            )
          }

          setDias(prev => prev.map(d =>
            d.day_number === dia.day_number ? { ...d, id: diaId } : d
          ))
        }
      }

      for (let i = 0; i < ingressos.length; i++) {
        const t = ingressos[i]
        if (!t.name.trim()) continue
        const payload = {
          event_id:     eventoId,
          event_day_id: t.event_day_id,
          name:         t.name.trim(),
          description:  t.description || null,
          price:        t.price,
          quantity:     t.quantity,
          order_index:  i,
        }
        if (t.id) {
          await supabase.from('event_tickets').update(payload).eq('id', t.id)
        } else {
          const { data } = await supabase.from('event_tickets').insert(payload).select('id').single()
          if (data) {
            setIngressos(prev => prev.map((x, xi) => xi === i ? { ...x, id: data.id } : x))
          }
        }
      }

      if (continuar) {
        router.push(`/criar-evento/${eventoId}/imagens`)
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { setErro('Erro ao salvar. Tente novamente.') }
    finally { setSaving(false) }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* Voltar */}
      <button type="button" onClick={() => router.push(`/criar-evento/${eventoId}`)}
        className="flex items-center gap-2 text-[#555] hover:text-white transition-colors text-sm w-fit"
        style={{ fontFamily: 'var(--font-dm-sans)' }}>
        <ArrowLeft size={15} />
        Voltar para informações do evento
      </button>

      {/* Seletor de modo (somente multi-day) */}
      {isMultiDay && (
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#141414]">
            <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Como serão vendidos os ingressos?
            </p>
            <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Escolha o modelo de compra para os {numDias} dias do evento
            </p>
          </div>
          <div className="p-6 flex flex-col gap-3">
            {([
              {
                value: 'individual' as const,
                icon:  Users,
                label: 'Individual por dia',
                desc:  'O participante compra ingresso para cada dia separadamente',
              },
              {
                value: 'pacote' as const,
                icon:  Package,
                label: 'Pacote completo',
                desc:  'Um único ingresso dá acesso a todos os dias do evento',
              },
              {
                value: 'ambos' as const,
                icon:  Layers,
                label: 'Individual + Pacote',
                desc:  'Oferece os dois: compra por dia ou pacote com desconto',
              },
            ]).map(({ value, icon: Icon, label, desc }) => (
              <button key={value} type="button" onClick={() => setTicketMode(value)}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200',
                  ticketMode === value
                    ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35'
                    : 'bg-[#111] border-[#1c1c1c] hover:border-[#2a2a2a]'
                )}
              >
                <div className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                  ticketMode === value ? 'bg-[#E8B84B]/15' : 'bg-[#161616]'
                )}>
                  <Icon size={16} className={ticketMode === value ? 'text-[#E8B84B]' : 'text-[#444]'} />
                </div>
                <div>
                  <p className={cn('text-sm font-medium', ticketMode === value ? 'text-white' : 'text-[#777]')}
                     style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
                  <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>{desc}</p>
                </div>
              </button>
            ))}

            {ticketMode === 'ambos' && (
              <div className="mt-1 p-4 bg-[#111] border border-[#E8B84B]/20 rounded-xl flex items-center gap-4">
                <div className="flex flex-col gap-1 flex-1">
                  <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Desconto no pacote completo
                  </label>
                  <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Aplicado sobre a soma dos ingressos individuais de todos os dias
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number" min="0" max="100" step="1"
                    value={packageDiscount || ''}
                    onChange={e => setPackageDiscount(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    placeholder="0"
                    className="w-16 bg-[#0d0d0d] border border-[#222] rounded-xl px-3 py-2 text-white text-sm text-center outline-none focus:border-[#E8B84B]/40"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                  <span className="text-[#E8B84B] text-lg font-bold" style={{ fontFamily: 'var(--font-outfit)' }}>%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Configuração quando modo selecionado */}
      {ticketMode && (
        <>
          {/* Modo PACOTE — ingressos globais */}
          {ticketMode === 'pacote' && (
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#141414] flex items-center gap-2">
                <Ticket size={14} className="text-[#E8B84B]" />
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Ingressos — Pacote completo ({numDias} dias)
                </p>
              </div>
              <div className="p-6">
                <IngressosPorDia
                  dayId={null}
                  label={`pacote ${numDias} dias`}
                  ingressos={ingressos}
                  onUpdate={updateIngresso}
                  onRemove={removeIngresso}
                  onAdd={addIngresso}
                  onAddSugestao={addIngressoSugestao}
                />
              </div>
            </div>
          )}

          {/* Modo INDIVIDUAL ou AMBOS — abas por dia */}
          {(ticketMode === 'individual' || ticketMode === 'ambos') && (
            <div className="flex flex-col gap-4">

              {/* Barra de abas */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
                {dias.map(dia => {
                  const ativo = diaAberto === dia.day_number
                  return (
                    <button key={dia.day_number} type="button"
                      onClick={() => setDiaAberto(dia.day_number)}
                      className={cn(
                        'flex-shrink-0 flex flex-col items-start px-4 py-2.5 rounded-xl border transition-all duration-200 text-left',
                        ativo
                          ? 'border-[#E8B84B]/40 bg-[#E8B84B]/8'
                          : 'border-[#1a1a1a] bg-[#0a0a0a] hover:border-[#2a2a2a]'
                      )}>
                      <span
                        className="text-[10px] font-bold tracking-wider uppercase"
                        style={{ color: ativo ? '#E8B84B' : '#444', fontFamily: 'var(--font-syne)' }}>
                        Dia {dia.day_number}
                      </span>
                      <span className="text-xs mt-0.5" style={{ color: ativo ? '#bbb' : '#333', fontFamily: 'var(--font-dm-sans)' }}>
                        {formatData(dia.date)}
                      </span>
                      {dia.start_time && (
                        <span className="text-[10px] mt-0.5" style={{ color: ativo ? '#666' : '#2a2a2a', fontFamily: 'var(--font-dm-sans)' }}>
                          {dia.start_time.slice(0,5)}{dia.end_time ? ` → ${dia.end_time.slice(0,5)}` : ''}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Conteúdo da aba ativa */}
              {dias.filter(dia => dia.day_number === diaAberto).map(dia => (
                <div key={dia.day_number} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                  <div className="px-6 pb-6 flex flex-col gap-5 pt-5">

                      {/* Horário do dia — só multi-day pede; single-day herdou do evento */}
                      {isMultiDay && (
                        <div className="flex flex-col gap-2">
                          <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Horário</label>

                          <div className="flex flex-col gap-1">
                            <span className="text-[#555] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>Abertura</span>
                            <TimeInput24h
                              value={dia.start_time}
                              onChange={v => handleStartTimeDia(dia.day_number, v)}
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[#555] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                              Duração <span className="text-[#333]">(calcula o encerramento)</span>
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {['2','4','6','8','12','18','24'].map(h => (
                                <button key={h} type="button"
                                  onClick={() => handleDuracaoDia(dia.day_number, h, dia.start_time)}
                                  className={cn(
                                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200',
                                    duracaoDia[dia.day_number] === h
                                      ? 'bg-[#E8B84B] text-[#070707] border-[#E8B84B]'
                                      : 'bg-transparent text-[#555] border-[#222] hover:border-[#444] hover:text-[#888]'
                                  )}
                                  style={{ fontFamily: 'var(--font-dm-sans)' }}>
                                  {h}h
                                </button>
                              ))}
                              <input
                                type="number" min="0.5" max="72" step="0.5" placeholder="Ex: 5"
                                value={['2','4','6','8','12','18','24'].includes(duracaoDia[dia.day_number] ?? '') ? '' : (duracaoDia[dia.day_number] ?? '')}
                                onChange={e => handleDuracaoDia(dia.day_number, e.target.value, dia.start_time)}
                                className="w-20 bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                                style={{ fontFamily: 'var(--font-dm-sans)' }}
                              />
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[#555] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                              Encerramento <span className="text-[#333]">(ajuste se necessário)</span>
                            </span>
                            <TimeInput24h
                              value={dia.end_time}
                              onChange={v => updateDia(dia.day_number, { end_time: v })}
                            />
                          </div>
                        </div>
                      )}

                      {/* Atrações */}
                      <div className="flex flex-col gap-2">
                        <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          Atrações / Lineup{' '}
                          <span className="text-[#333] normal-case tracking-normal font-normal">(opcional)</span>
                        </label>
                        {dia.attractions.map((a, ai) => (
                          <div key={ai} className="flex gap-2">
                            <input type="text" placeholder="Nome do artista ou atração"
                              value={a.name}
                              onChange={e => updateAttraction(dia.day_number, ai, { name: e.target.value })}
                              className={cn(inputCls, 'flex-1')}
                              style={{ fontFamily: 'var(--font-dm-sans)' }} />
                            <div className="shrink-0">
                              <TimeInput24h
                                compact
                                value={a.scheduled_time ?? ''}
                                onChange={v => updateAttraction(dia.day_number, ai, { scheduled_time: v })}
                              />
                            </div>
                            <button type="button" onClick={() => removeAttraction(dia.day_number, ai)}
                              className="text-[#2a2a2a] hover:text-red-500 transition-colors px-2">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addAttraction(dia.day_number)}
                          className="flex items-center gap-2 text-[#444] hover:text-[#E8B84B] text-xs transition-colors py-1"
                          style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          <Plus size={13} /> Adicionar atração
                        </button>
                      </div>

                      {/* Ingressos do dia */}
                      <IngressosPorDia
                        dayId={dia.id ?? `new-${dia.day_number}`}
                        label={`dia ${dia.day_number}`}
                        ingressos={ingressos}
                        onUpdate={updateIngresso}
                        onRemove={removeIngresso}
                        onAdd={addIngresso}
                        onAddSugestao={addIngressoSugestao}
                      />

                  </div>
                </div>
              ))}

              {/* Pacote com desconto — aparece abaixo dos dias quando modo=ambos */}
              {ticketMode === 'ambos' && (
                <div className="bg-[#0d0d0d] border border-[#E8B84B]/15 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#141414] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package size={14} className="text-[#E8B84B]" />
                      <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        Pacote completo — {numDias} dias
                      </p>
                    </div>
                    {packageDiscount > 0 && (
                      <span className="text-[#E8B84B] text-xs font-semibold bg-[#E8B84B]/10 border border-[#E8B84B]/20 px-2 py-0.5 rounded-full"
                            style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {packageDiscount}% OFF
                      </span>
                    )}
                  </div>
                  <div className="p-6">
                    <IngressosPorDia
                      dayId={null}
                      label="pacote completo"
                      ingressos={ingressos}
                      onUpdate={updateIngresso}
                      onRemove={removeIngresso}
                      onAdd={addIngresso}
                      onAddSugestao={addIngressoSugestao}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botões */}
          {erro && <p className="text-red-400 text-sm text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>}

          <div className="flex gap-3 sticky bottom-4">
            <button type="button" onClick={() => handleSalvar(false)} disabled={saving}
              className="flex-none px-5 py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40 bg-[#111] border border-[#222] text-[#555] hover:text-[#888] hover:border-[#333]"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {saved ? <><Check size={15} /><span>Salvo!</span></> : <span>Salvar rascunho</span>}
            </button>
            <button type="button" onClick={() => handleSalvar(true)} disabled={saving}
              className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-[#070707] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
              {saving
                ? <Loader2 size={15} className="animate-spin" />
                : <><span>Salvar e continuar</span><ArrowRight size={15} /></>
              }
            </button>
          </div>
        </>
      )}

    </div>
  )
}
