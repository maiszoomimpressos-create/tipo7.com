'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, Rocket,
  CalendarDays, MapPin, Ticket, Tag, Users, Package, Layers,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Resumo {
  titulo:      string
  descricao:   string
  categoria:   string
  dateStart:   string
  dateEnd:     string
  numDias:     number
  nomeLocal:   string
  cidade:      string
  estado:      string
  rua:         string
  ticketMode:  'individual' | 'pacote' | 'ambos' | null
  packageDiscount: number
  bannerUrl:   string | null
}
interface DiaResumo {
  day_number:  number
  date:        string
  start_time:  string
  end_time:    string
  attractions: string[]
}
interface IngressoResumo {
  name:         string
  price:        number
  quantity:     number
  event_day_id: string | null
}

interface Props {
  eventoId:    string
  statusAtual: 'rascunho' | 'publicado' | 'cancelado'
  resumo:      Resumo
  dias:        DiaResumo[]
  ingressos:   IngressoResumo[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIAS_PT    = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MESES_PT   = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

const formatData = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${DIAS_PT[d.getDay()]}, ${d.getDate()} ${MESES_PT[d.getMonth()]} ${d.getFullYear()}`
}

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const labelTicketMode: Record<string, string> = {
  individual: 'Individual por dia',
  pacote:     'Pacote completo',
  ambos:      'Individual + Pacote',
}
const iconTicketMode = { individual: Users, pacote: Package, ambos: Layers }

// ─── Item de checklist ────────────────────────────────────────────────────────

function CheckItem({ ok, label, sub, href, eventoId }: {
  ok: boolean; label: string; sub?: string; href?: string; eventoId: string
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#111] last:border-0">
      {ok
        ? <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
        : <XCircle     size={16} className="text-red-400/70 mt-0.5 shrink-0" />
      }
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm', ok ? 'text-white' : 'text-[#666]')}
           style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
        {sub && <p className="text-[#444] text-xs mt-0.5 truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>{sub}</p>}
      </div>
      {!ok && href && (
        <a href={href}
          className="text-[#E8B84B] text-xs hover:underline shrink-0 flex items-center gap-1"
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Preencher <ExternalLink size={10} />
        </a>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function PublicarClient({ eventoId, statusAtual, resumo, dias, ingressos }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  const [publishing, setPublishing] = useState(false)
  const [erro,       setErro]       = useState<string | null>(null)
  const jaPublicado = statusAtual === 'publicado'

  // ── Checklist de requisitos ──
  const checks = {
    titulo:    !!resumo.titulo,
    data:      !!resumo.dateStart,
    local:     !!(resumo.cidade || resumo.nomeLocal),
    ingressos: ingressos.length > 0 && ingressos.every(t => t.name && t.quantity > 0),
  }
  const podePubilcar  = Object.values(checks).every(Boolean)
  const semBanner     = !resumo.bannerUrl

  // ── Publica o evento ──
  const handlePublicar = async () => {
    if (!podePubilcar) return
    setPublishing(true); setErro(null)
    try {
      const { error } = await supabase
        .from('events')
        .update({ status: 'publicado' })
        .eq('id', eventoId)
      if (error) throw error
      router.push(`/criar-evento/${eventoId}/publicado`)
    } catch {
      setErro('Erro ao publicar. Tente novamente.')
      setPublishing(false)
    }
  }

  // ── Despublica (volta para rascunho) ──
  const handleDespublicar = async () => {
    if (!confirm('Tem certeza? O evento ficará invisível para compradores.')) return
    setPublishing(true)
    try {
      await supabase.from('events').update({ status: 'rascunho' }).eq('id', eventoId)
      router.refresh()
    } finally { setPublishing(false) }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* Voltar */}
      <button type="button" onClick={() => router.push(`/criar-evento/${eventoId}/imagens`)}
        className="flex items-center gap-2 text-[#555] hover:text-white transition-colors text-sm w-fit"
        style={{ fontFamily: 'var(--font-dm-sans)' }}>
        <ArrowLeft size={15} />
        Voltar para imagens
      </button>

      {/* ── Status atual ── */}
      {jaPublicado && (
        <div className="flex items-center gap-2.5 bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-3">
          <CheckCircle2 size={14} className="text-green-400 shrink-0" />
          <p className="text-green-400 text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Este evento está publicado e visível para compradores.
          </p>
        </div>
      )}

      {/* ── Checklist ── */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#141414]">
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Checklist para publicação
          </p>
          <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {podePubilcar ? 'Tudo pronto! Você pode publicar o evento.' : 'Complete os itens abaixo antes de publicar.'}
          </p>
        </div>
        <div className="px-6">
          <CheckItem ok={checks.titulo}    eventoId={eventoId} label="Nome do evento"    sub={resumo.titulo || undefined}    href={`/criar-evento/${eventoId}`} />
          <CheckItem ok={checks.data}      eventoId={eventoId} label="Data de início"    sub={resumo.dateStart ? formatData(resumo.dateStart) : undefined} href={`/criar-evento/${eventoId}`} />
          <CheckItem ok={checks.local}     eventoId={eventoId} label="Local do evento"   sub={resumo.nomeLocal || resumo.cidade || undefined} href={`/criar-evento/${eventoId}`} />
          <CheckItem ok={checks.ingressos} eventoId={eventoId} label="Ingressos configurados" sub={ingressos.length > 0 ? `${ingressos.length} tipo${ingressos.length > 1 ? 's' : ''}` : undefined} href={`/criar-evento/${eventoId}/ingressos`} />

          {/* Aviso de banner — não bloqueia publicação, só alerta */}
          {semBanner && (
            <div className="flex items-start gap-3 py-3 border-t border-[#111]">
              <div className="w-4 h-4 rounded-full bg-[#E8B84B]/20 border border-[#E8B84B]/40 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[#E8B84B] text-[9px] font-bold leading-none">!</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#E8B84B] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Sem banner — recomendado
                </p>
                <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Eventos com imagem têm muito mais cliques na listagem.
                </p>
              </div>
              <a href={`/criar-evento/${eventoId}/imagens`}
                className="text-[#E8B84B] text-xs hover:underline shrink-0 flex items-center gap-1"
                style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Adicionar <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Resumo do evento ── */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#141414]">
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Resumo do evento</p>
        </div>
        <div className="p-6 flex flex-col gap-5">

          {/* Título e descrição */}
          <div>
            <p className="text-white font-medium" style={{ fontFamily: 'var(--font-outfit)' }}>{resumo.titulo || '—'}</p>
            {resumo.categoria && (
              <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E8B84B]/10 border border-[#E8B84B]/20 text-[#E8B84B]"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <Tag size={9} /> {resumo.categoria}
              </span>
            )}
            {resumo.descricao && (
              <p className="text-[#555] text-xs mt-2 line-clamp-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {resumo.descricao}
              </p>
            )}
          </div>

          {/* Data */}
          {resumo.dateStart && (
            <div className="flex items-start gap-3">
              <CalendarDays size={15} className="text-[#E8B84B] mt-0.5 shrink-0" />
              <div>
                <p className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {formatData(resumo.dateStart)}
                  {resumo.numDias > 1 && (
                    <span className="text-[#555] ml-2">+ {resumo.numDias - 1} dia{resumo.numDias > 2 ? 's' : ''}</span>
                  )}
                </p>
                {resumo.numDias > 1 && resumo.dateEnd && (
                  <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    até {formatData(resumo.dateEnd)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Local */}
          {(resumo.nomeLocal || resumo.cidade) && (
            <div className="flex items-start gap-3">
              <MapPin size={15} className="text-[#E8B84B] mt-0.5 shrink-0" />
              <div>
                {resumo.nomeLocal && (
                  <p className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>{resumo.nomeLocal}</p>
                )}
                {resumo.rua && (
                  <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{resumo.rua}</p>
                )}
                {resumo.cidade && (
                  <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {resumo.cidade}{resumo.estado ? `, ${resumo.estado}` : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Modo de ingresso */}
          {resumo.ticketMode && (
            <div className="flex items-start gap-3">
              {(() => { const Icon = iconTicketMode[resumo.ticketMode]; return <Icon size={15} className="text-[#E8B84B] mt-0.5 shrink-0" /> })()}
              <div>
                <p className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {labelTicketMode[resumo.ticketMode]}
                </p>
                {resumo.ticketMode === 'ambos' && resumo.packageDiscount > 0 && (
                  <p className="text-[#E8B84B] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {resumo.packageDiscount}% de desconto no pacote completo
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Ingressos */}
          {ingressos.length > 0 && (
            <div className="flex items-start gap-3">
              <Ticket size={15} className="text-[#E8B84B] mt-0.5 shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1">
                {ingressos.map((t, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>{t.name}</span>
                    <div className="flex items-center gap-3 text-xs text-[#555]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      <span>{t.quantity} unid.</span>
                      <span className="text-[#E8B84B] font-medium">{formatBRL(t.price)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dias */}
          {dias.length > 0 && (
            <div className="border-t border-[#111] pt-4 flex flex-col gap-2">
              <p className={cn('text-[11px] font-medium tracking-widest uppercase text-[#666]')}
                 style={{ fontFamily: 'var(--font-dm-sans)' }}>Programação por dia</p>
              {dias.map(d => (
                <div key={d.day_number} className="flex items-start gap-3 text-sm">
                  <span className="text-[#E8B84B] font-semibold w-10 shrink-0" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Dia {d.day_number}
                  </span>
                  <div>
                    {d.start_time && (
                      <span className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {d.start_time.slice(0,5)}{d.end_time ? ` – ${d.end_time.slice(0,5)}` : ''}
                      </span>
                    )}
                    {d.attractions.length > 0 && (
                      <p className="text-[#777] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {d.attractions.join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ── Erro ── */}
      {erro && (
        <p className="text-red-400 text-sm text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>
      )}

      {/* ── Botão principal ── */}
      {!jaPublicado ? (
        <button type="button" onClick={handlePublicar}
          disabled={!podePubilcar || publishing}
          className="w-full py-4 rounded-xl text-sm font-semibold text-[#070707] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-40 sticky bottom-4"
          style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
          {publishing
            ? <Loader2 size={16} className="animate-spin" />
            : <><Rocket size={16} /><span>Publicar evento agora</span></>
          }
        </button>
      ) : (
        <div className="flex gap-3 sticky bottom-4">
          <a href={`/evento/${eventoId}`}
            className="flex-1 py-4 rounded-xl text-sm font-semibold text-[#070707] hover:brightness-110 transition-all flex items-center justify-center gap-2"
            style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
            <ExternalLink size={15} />
            Ver página do evento
          </a>
          <button type="button" onClick={handleDespublicar} disabled={publishing}
            className="px-5 py-4 rounded-xl text-sm text-[#555] border border-[#222] hover:text-red-400 hover:border-red-400/30 transition-all disabled:opacity-40"
            style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Despublicar
          </button>
        </div>
      )}

    </div>
  )
}
