'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { apiFetchAuth } from '@/lib/apiFetch'
import {
  Users, Package, Layers, Plus, Trash2, Loader2,
  Ticket, ArrowRight, Check, ArrowLeft, CalendarCheck, ImageIcon, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SecaoBloqueavel } from '@/components/SecaoBloqueavel'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface Attraction { id?: string; name: string; description: string; order_index: number; scheduled_time?: string; image_url?: string | null }
interface DiaConfig {
  id?:         string
  day_number:  number
  date:        string
  start_time:  string
  end_time:    string
  banner_url?: string | null
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

interface DiaHerdavel {
  id:         string | null
  day_number: number
  date:       string
  start_time: string
  end_time:   string
}

interface Props {
  eventoId:              string
  numDias:               number
  dateStart:             string
  dateEnd:               string
  diasHerdaveis?:        DiaHerdavel[]
  ticketModeInicial:     'individual' | 'pacote' | 'ambos' | null
  packageDiscountInicial: number
  diasIniciais:          DiaConfig[]
  ingressosIniciais:     IngressoConfig[]
  infoCompleta:          boolean
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
  diasHerdaveis,
  ticketModeInicial,
  packageDiscountInicial,
  diasIniciais,
  ingressosIniciais,
  infoCompleta,
}: Props) {
  const router   = useRouter()
  const supabase = createClient()

  // Se chegou aqui direto (ex: atalho da lista de eventos) sem ter completado
  // Informações, o "continuar" deve voltar pra lá em vez de seguir adiante —
  // senão o promotor acaba na última etapa com dados básicos faltando.
  const destinoContinuar = infoCompleta
    ? `/criar-evento/${eventoId}/imagens`
    : `/criar-evento/${eventoId}`

  const modoHeranca = !!diasHerdaveis
  const isMultiDay  = modoHeranca ? true : numDias > 1

  const [ticketMode, setTicketMode] = useState<'individual' | 'pacote' | 'ambos' | null>(
    ticketModeInicial ?? (isMultiDay ? null : 'individual')
  )
  const [packageDiscount, setPackageDiscount] = useState(packageDiscountInicial)

  const datas = gerarDatas(dateStart, numDias)
  const [dias, setDias] = useState<DiaConfig[]>(() => {
    if (diasIniciais.length > 0) return diasIniciais
    if (modoHeranca) return [] // promotor escolhe os dias no seletor abaixo
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

  // Dias do pai já usados por este filho (por data) — evita duplicar ao marcar/desmarcar
  const datasSelecionadas = new Set(dias.map(d => d.date))

  function toggleDiaHerdado(dia: DiaHerdavel) {
    if (datasSelecionadas.has(dia.date)) {
      setDias(prev => {
        const restantes = prev.filter(d => d.date !== dia.date)
        return restantes.map((d, i) => ({ ...d, day_number: i + 1 }))
      })
      return
    }
    setDias(prev => {
      const novo: DiaConfig = {
        day_number:  prev.length + 1,
        date:        dia.date,
        start_time:  dia.start_time,
        end_time:    dia.end_time,
        attractions: [],
      }
      return [...prev, novo].sort((a, b) => a.date.localeCompare(b.date)).map((d, i) => ({ ...d, day_number: i + 1 }))
    })
  }

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

  const [uploadingAttraction, setUploadingAttraction] = useState<string | null>(null)
  const [uploadingDiaBanner, setUploadingDiaBanner] = useState<number | null>(null)

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

  const handleSalvar = async (destino?: string) => {
    setSaving(true); setErro(null)
    try {
      // Em modo herança (Tenda/Estacionamento), date_start/date_end do filho
      // acompanham o min/max dos dias escolhidos — não pede isso na Seção 2.
      const datasEscolhidas = modoHeranca ? dias.map(d => d.date).sort() : null
      const novoDateStart = datasEscolhidas?.length ? `${datasEscolhidas[0]}T${(dias.find(d => d.date === datasEscolhidas[0])?.start_time || '00:00')}` : undefined
      const novoDateEnd   = datasEscolhidas?.length ? `${datasEscolhidas[datasEscolhidas.length - 1]}T${(dias.find(d => d.date === datasEscolhidas[datasEscolhidas.length - 1])?.end_time || '23:59')}` : undefined

      await supabase.from('events').update({
        ticket_mode:          ticketMode,
        package_discount_pct: packageDiscount,
        ...(novoDateStart ? { date_start: novoDateStart } : {}),
        ...(novoDateEnd   ? { date_end:   novoDateEnd   } : {}),
      }).eq('id', eventoId)

      // Mapa placeholder ("new-{date}" ou id real) → id real do dia, montado
      // durante o próprio save — sem isso, ingressos ligados a um dia recém-criado
      // tentariam gravar a chave temporária como event_day_id (UUID inválido).
      const idPlaceholderParaReal: Record<string, string> = {}

      if (ticketMode !== 'pacote') {
        const diasAtualizados: DiaConfig[] = []
        for (const dia of dias) {
          const chavePlaceholder = dia.id ?? `new-${dia.date}`
          const { data: diaDb } = dia.id
            ? await supabase.from('event_days').upsert({
                id:         dia.id,
                event_id:   eventoId,
                day_number: dia.day_number,
                date:       dia.date,
                start_time: dia.start_time || null,
                end_time:   dia.end_time   || null,
                banner_url: dia.banner_url || null,
              }).select('id').single()
            : await supabase.from('event_days').upsert({
                event_id:   eventoId,
                day_number: dia.day_number,
                date:       dia.date,
                start_time: dia.start_time || null,
                end_time:   dia.end_time   || null,
                banner_url: dia.banner_url || null,
              }, { onConflict: 'event_id,day_number' }).select('id').single()

          if (!diaDb) { diasAtualizados.push(dia); continue }
          const diaId = diaDb.id
          idPlaceholderParaReal[chavePlaceholder] = diaId
          diasAtualizados.push({ ...dia, id: diaId })

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
                image_url:      a.image_url || null,
              }))
            )
          }
        }
        setDias(diasAtualizados)
      }

      for (let i = 0; i < ingressos.length; i++) {
        const t = ingressos[i]
        if (!t.name.trim()) continue
        const eventDayIdReal = t.event_day_id
          ? (idPlaceholderParaReal[t.event_day_id] ?? t.event_day_id)
          : null
        const payload = {
          event_id:     eventoId,
          event_day_id: eventDayIdReal,
          name:         t.name.trim(),
          description:  t.description || null,
          price:        t.price,
          quantity:     t.quantity,
          order_index:  i,
        }
        if (t.id) {
          await supabase.from('event_tickets').update(payload).eq('id', t.id)
          if (eventDayIdReal !== t.event_day_id) {
            setIngressos(prev => prev.map((x, xi) => xi === i ? { ...x, event_day_id: eventDayIdReal } : x))
          }
        } else {
          const { data } = await supabase.from('event_tickets').insert(payload).select('id').single()
          if (data) {
            setIngressos(prev => prev.map((x, xi) => xi === i ? { ...x, id: data.id, event_day_id: eventDayIdReal } : x))
          }
        }
      }

      if (destino) {
        router.push(destino)
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { setErro('Erro ao salvar. Tente novamente.') }
    finally { setSaving(false) }
  }

  // Caminho posicional pelo número do dia — estável entre saves, já que o
  // day_number não muda depois de definido (mesma lógica das imagens de atração).
  // Persiste na hora, direto no banco (igual o banner principal do evento, que
  // já salva assim que envia) — pra não perder o upload se o usuário navegar
  // antes de clicar em "Salvar rascunho". Não usa handleSalvar aqui porque
  // ele leria o `dias` antigo (o setState do updateDia ainda não aplicou).
  async function handleDiaBanner(dayNumber: number, file: File) {
    setUploadingDiaBanner(dayNumber)
    setErro(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiFetchAuth(`/api/uploads/event-image/${eventoId}`, { method: 'POST', body: formData })
      if (!res.ok) {
        setErro('Erro ao subir banner do dia')
        return
      }
      const { url } = await res.json()
      updateDia(dayNumber, { banner_url: url })

      const diaAtual = dias.find(d => d.day_number === dayNumber)
      if (diaAtual?.id) {
        await supabase.from('event_days').update({ banner_url: url }).eq('id', diaAtual.id)
      } else if (diaAtual) {
        const { data: diaDb } = await supabase.from('event_days').upsert({
          event_id:   eventoId,
          day_number: dayNumber,
          date:       diaAtual.date,
          start_time: diaAtual.start_time || null,
          end_time:   diaAtual.end_time   || null,
          banner_url: url,
        }, { onConflict: 'event_id,day_number' }).select('id').single()
        if (diaDb) updateDia(dayNumber, { id: diaDb.id })
      }
    } catch (e) {
      setErro(`Erro ao subir banner do dia: ${e instanceof Error ? e.message : 'erro desconhecido'}`)
    } finally {
      setUploadingDiaBanner(null)
    }
  }

  // Caminho posicional (dia + índice), não pelo id da atração — a linha de
  // event_day_attractions é apagada e recriada a cada save, então o id muda
  // toda vez; o caminho do arquivo precisa ser estável entre saves.
  async function handleAttractionImage(dayNumber: number, idx: number, file: File) {
    const key = `${dayNumber}-${idx}`
    setUploadingAttraction(key)
    setErro(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiFetchAuth(`/api/uploads/event-image/${eventoId}`, { method: 'POST', body: formData })
      if (!res.ok) {
        setErro('Erro ao subir imagem da atração')
        return
      }
      const { url } = await res.json()
      updateAttraction(dayNumber, idx, { image_url: url })
    } catch (e) {
      setErro(`Erro ao subir imagem da atração: ${e instanceof Error ? e.message : 'erro desconhecido'}`)
    } finally {
      setUploadingAttraction(null)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* Indicador de etapas — todas navegáveis; ir e voltar sempre salva
          primeiro, pra nunca perder o que já foi preenchido */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => handleSalvar(`/criar-evento/${eventoId}`)} disabled={saving}
          className="flex items-center gap-1.5 text-[#555] hover:text-white text-xs transition-colors disabled:opacity-40"
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {infoCompleta
            ? <span className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-500 text-[10px]">✓</span>
            : <span className="w-5 h-5 rounded-full bg-[#111] border border-[#222] flex items-center justify-center text-[10px]">1</span>
          }
          Informações
        </button>
        <div className="h-px flex-1 bg-[#1a1a1a]" />
        <div className="flex items-center gap-1.5 text-white text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <span className="w-5 h-5 rounded-full bg-[#E8B84B] flex items-center justify-center text-[#070707] text-[10px] font-bold">2</span>
          Ingressos
        </div>
        <div className="h-px flex-1 bg-[#1a1a1a]" />
        <button type="button" onClick={() => handleSalvar(`/criar-evento/${eventoId}/imagens`)} disabled={saving}
          className="flex items-center gap-1.5 text-[#555] hover:text-white text-xs transition-colors disabled:opacity-40"
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <span className="w-5 h-5 rounded-full bg-[#111] border border-[#222] flex items-center justify-center text-[10px]">3</span>
          Imagens
        </button>
        <div className="h-px flex-1 bg-[#1a1a1a]" />
        <button type="button" onClick={() => handleSalvar(`/criar-evento/${eventoId}/publicar`)} disabled={saving}
          className="flex items-center gap-1.5 text-[#555] hover:text-white text-xs transition-colors disabled:opacity-40"
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <span className="w-5 h-5 rounded-full bg-[#111] border border-[#222] flex items-center justify-center text-[10px]">4</span>
          Publicar
        </button>
      </div>

      {/* Voltar */}
      <button type="button" onClick={() => handleSalvar(`/criar-evento/${eventoId}`)} disabled={saving}
        className="flex items-center gap-2 text-[#555] hover:text-white transition-colors text-sm w-fit disabled:opacity-40"
        style={{ fontFamily: 'var(--font-dm-sans)' }}>
        <ArrowLeft size={15} />
        Voltar para informações do evento
      </button>

      {/* Seletor de dias herdados do pai (Tenda/Estacionamento) */}
      {modoHeranca && (
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#141414] flex items-center gap-2">
            <CalendarCheck size={14} className="text-[#E8B84B]" />
            <div>
              <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Em quais dias este evento acontece?
              </p>
              <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Marque um ou mais dias do evento principal — não precisam ser seguidos
              </p>
            </div>
          </div>
          <div className="p-6 flex flex-wrap gap-2">
            {(diasHerdaveis ?? []).length === 0 && (
              <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                O evento principal ainda não tem dias/data cadastrados. Cadastre a data dele primeiro.
              </p>
            )}
            {(diasHerdaveis ?? []).map(dh => {
              const marcado = datasSelecionadas.has(dh.date)
              return (
                <button key={dh.date} type="button" onClick={() => toggleDiaHerdado(dh)}
                  className={cn(
                    'flex flex-col items-start px-4 py-2.5 rounded-xl border text-left transition-all duration-200',
                    marcado
                      ? 'border-[#E8B84B]/40 bg-[#E8B84B]/8'
                      : 'border-[#1a1a1a] bg-[#0a0a0a] hover:border-[#2a2a2a]'
                  )}>
                  <span className="text-[10px] font-bold tracking-wider uppercase"
                        style={{ color: marcado ? '#E8B84B' : '#444', fontFamily: 'var(--font-syne)' }}>
                    {formatData(dh.date)}
                  </span>
                  {dh.start_time && (
                    <span className="text-[10px] mt-0.5" style={{ color: marcado ? '#bbb' : '#333', fontFamily: 'var(--font-dm-sans)' }}>
                      {dh.start_time.slice(0,5)}{dh.end_time ? ` → ${dh.end_time.slice(0,5)}` : ''}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Seletor de modo (somente multi-day) — compacto, 3 opções lado a lado */}
      {isMultiDay && dias.length > 0 && (
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#141414]">
            <p className="text-white text-xs font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Como serão vendidos os ingressos?
            </p>
          </div>
          <div className="p-3 grid grid-cols-3 gap-2">
            {([
              { value: 'individual' as const, icon: Users,   label: 'Individual por dia' },
              { value: 'pacote'     as const, icon: Package, label: 'Pacote completo'    },
              { value: 'ambos'      as const, icon: Layers,  label: 'Individual + Pacote' },
            ]).map(({ value, icon: Icon, label }) => (
              <button key={value} type="button" onClick={() => setTicketMode(value)}
                title={label}
                className={cn(
                  'flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border text-center transition-all duration-200',
                  ticketMode === value
                    ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35'
                    : 'bg-[#111] border-[#1c1c1c] hover:border-[#2a2a2a]'
                )}
              >
                <Icon size={14} className={ticketMode === value ? 'text-[#E8B84B]' : 'text-[#444]'} />
                <p className={cn('text-[11px] leading-tight font-medium', ticketMode === value ? 'text-white' : 'text-[#777]')}
                   style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
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

                      {/* Atrações — libera assim que o horário de abertura do dia é preenchido */}
                      <SecaoBloqueavel ativo={!!dia.start_time} mensagem="Preencha a Abertura do dia primeiro">
                      {isMultiDay && (
                        <div className="flex items-center gap-3 mb-4">
                          <div className="relative shrink-0 w-16 h-16">
                            <label className={cn(
                              'absolute inset-0 rounded-xl overflow-hidden border border-[#222] flex items-center justify-center cursor-pointer bg-[#0a0a0a]',
                              uploadingDiaBanner === dia.day_number && 'pointer-events-none opacity-60'
                            )}>
                              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleDiaBanner(dia.day_number, f) }} />
                              {uploadingDiaBanner === dia.day_number
                                ? <Loader2 size={16} className="animate-spin text-[#E8B84B]" />
                                : dia.banner_url
                                  ? <img src={dia.banner_url} alt="" className="w-full h-full object-cover" />
                                  : <ImageIcon size={16} className="text-[#333]" />
                              }
                            </label>
                            {dia.banner_url && uploadingDiaBanner !== dia.day_number && (
                              <button type="button"
                                onClick={() => updateDia(dia.day_number, { banner_url: null })}
                                title="Remover banner deste dia"
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-[#888] hover:text-red-500 hover:border-red-500/40 transition-colors z-10">
                                <X size={11} />
                              </button>
                            )}
                          </div>
                          <div>
                            <p className="text-white text-xs font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                              Banner deste dia{' '}
                              <span className="text-[#333] normal-case tracking-normal font-normal">(opcional)</span>
                            </p>
                            <p className="text-[#444] text-[11px] mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                              Sem banner próprio, este dia usa o banner principal do evento
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          Atrações / Lineup{' '}
                          <span className="text-[#333] normal-case tracking-normal font-normal">(opcional)</span>
                        </label>
                        {dia.attractions.map((a, ai) => {
                          const uploadKey = `${dia.day_number}-${ai}`
                          const uploading = uploadingAttraction === uploadKey
                          return (
                          <div key={ai} className="flex flex-col gap-2 bg-[#0a0a0a] border border-[#161616] rounded-xl p-2.5">
                          <div className="flex gap-2">
                            {/* Miniatura/upload da imagem do show — não muda entre saves,
                                caminho é posicional (dia + índice), não pelo id */}
                            <label className={cn(
                              'relative shrink-0 w-11 h-11 rounded-lg overflow-hidden border border-[#222] flex items-center justify-center cursor-pointer',
                              uploading && 'pointer-events-none opacity-60'
                            )}>
                              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleAttractionImage(dia.day_number, ai, f) }} />
                              {uploading
                                ? <Loader2 size={14} className="animate-spin text-[#E8B84B]" />
                                : a.image_url
                                  ? <img src={a.image_url} alt="" className="w-full h-full object-cover" />
                                  : <ImageIcon size={14} className="text-[#333]" />
                              }
                            </label>
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
                          <textarea placeholder="Descrição do show (opcional) — aparece na página pública junto com o banner"
                            value={a.description}
                            onChange={e => updateAttraction(dia.day_number, ai, { description: e.target.value })}
                            rows={2} maxLength={500}
                            className={cn(inputCls, 'resize-none text-xs')}
                            style={{ fontFamily: 'var(--font-dm-sans)' }} />
                          </div>
                          )
                        })}
                        <button type="button" onClick={() => addAttraction(dia.day_number)}
                          className="flex items-center gap-2 text-[#444] hover:text-[#E8B84B] text-xs transition-colors py-1"
                          style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          <Plus size={13} /> Adicionar atração
                        </button>
                      </div>
                      </SecaoBloqueavel>

                      {/* Ingressos do dia — mesmo gatilho da seção de Atrações */}
                      <SecaoBloqueavel ativo={!!dia.start_time} mensagem="Preencha a Abertura do dia primeiro">
                      <IngressosPorDia
                        dayId={dia.id ?? `new-${dia.date}`}
                        label={`dia ${dia.day_number}`}
                        ingressos={ingressos}
                        onUpdate={updateIngresso}
                        onRemove={removeIngresso}
                        onAdd={addIngresso}
                        onAddSugestao={addIngressoSugestao}
                      />
                      </SecaoBloqueavel>

                      {/* Navegação entre dias — deixa óbvio que cada dia precisa
                          de atenção, em vez de depender de lembrar das abas */}
                      {dias.length > 1 && (
                        <div className="flex items-center gap-2 pt-2 border-t border-[#141414]">
                          <button type="button"
                            onClick={() => setDiaAberto(d => Math.max(1, d - 1))}
                            disabled={dia.day_number === 1}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{ borderColor: '#222', color: '#888', fontFamily: 'var(--font-dm-sans)' }}>
                            <ArrowLeft size={13} /> Dia anterior
                          </button>
                          {(() => {
                            const ultimoDia = dia.day_number === dias.length
                            const proximaData = dias.find(d => d.day_number === dia.day_number + 1)?.date
                            return (
                              <button type="button"
                                onClick={() => setDiaAberto(d => Math.min(dias.length, d + 1))}
                                disabled={ultimoDia}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                style={{ background: ultimoDia ? 'transparent' : '#E8B84B', border: ultimoDia ? '1px solid #222' : 'none', color: ultimoDia ? '#888' : '#070707', fontFamily: 'var(--font-dm-sans)' }}>
                                {ultimoDia
                                  ? 'Último dia'
                                  : <>Próximo dia — {proximaData ? formatData(proximaData) : ''} <ArrowRight size={13} /></>}
                              </button>
                            )
                          })()}
                        </div>
                      )}

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
            <button type="button" onClick={() => handleSalvar()} disabled={saving}
              className="flex-none px-5 py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40 bg-[#111] border border-[#222] text-[#555] hover:text-[#888] hover:border-[#333]"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {saved ? <><Check size={15} /><span>Salvo!</span></> : <span>Salvar rascunho</span>}
            </button>
            <button type="button" onClick={() => handleSalvar(destinoContinuar)} disabled={saving}
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
