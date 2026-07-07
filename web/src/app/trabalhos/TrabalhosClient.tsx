'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Briefcase, Calendar, MapPin, Shield, Check, X,
  Loader2, ChevronRight, CheckCircle2, Bell,
  ScanQrCode, ShoppingCart, ClipboardList, BarChart2, ArrowRight,
} from 'lucide-react'

const ACCENT = '#E8B84B'

const PERMISSAO_LABEL: Record<string, string> = {
  validar_ingresso:     'Validar ingressos',
  vender_ingresso:      'Bilheteria',
  ver_lista_convidados: 'Ver lista de compradores',
  ver_relatorios:       'Ver relatórios',
  gerenciar_checkin:    'Gerenciar check-in',
}

type Evento = {
  id: string
  title: string | null
  date_start: string | null
  venue_name: string | null
  city: string | null
  state: string | null
  banner_url: string | null
}

type Registro = {
  id: string
  status: string
  created_at: string
  events: Evento | null
  event_positions: {
    id: string
    name: string
    event_position_permissions: { permission: string }[]
  } | null
  convidado_por: { full_name: string | null } | null
}

interface Props {
  registros: Registro[]
}

// ── Modal de convite ──────────────────────────────────────────────────────────

function ModalConvite({
  registro,
  onFechar,
  onResponder,
  respondendo,
}: {
  registro: Registro
  onFechar: () => void
  onResponder: (acao: 'aceitar' | 'recusar') => void
  respondendo: boolean
}) {
  const evento = registro.events
  const cargo  = registro.event_positions
  const perms  = cargo?.event_position_permissions ?? []
  const quemConvidou = (registro.convidado_por as { full_name: string | null } | null)?.full_name

  // Fecha ao pressionar Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onFechar])

  function formatarData(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#0d0d0d', border: `1px solid ${ACCENT}25` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Faixa dourada topo */}
        <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }} />

        {/* Banner do evento */}
        {evento?.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={evento.banner_url}
            alt={evento.title ?? 'Evento'}
            className="w-full h-32 object-cover"
          />
        ) : (
          <div className="w-full h-20 flex items-center justify-center" style={{ background: '#111' }}>
            <Briefcase size={24} className="text-[#2a2a2a]" />
          </div>
        )}

        <div className="p-5">
          {/* Aviso de convite */}
          <div className="flex items-center gap-2 mb-3">
            <Bell size={12} style={{ color: ACCENT }} />
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
              Convite para trabalhar
            </span>
          </div>

          {/* Nome do evento */}
          <p className="text-white text-lg font-semibold mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
            {evento?.title ?? 'Evento'}
          </p>

          {/* Data e local */}
          <div className="flex flex-col gap-1 mb-4">
            {evento?.date_start && (
              <span className="flex items-center gap-1.5 text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <Calendar size={11} />
                {formatarData(evento.date_start)}
              </span>
            )}
            {(evento?.venue_name || evento?.city) && (
              <span className="flex items-center gap-1.5 text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <MapPin size={11} />
                {[evento.venue_name, evento.city, evento.state].filter(Boolean).join(', ')}
              </span>
            )}
          </div>

          {/* Cargo e permissões */}
          <div className="rounded-xl p-3.5 mb-4" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
            <div className="flex items-center gap-2 mb-2.5">
              <Shield size={13} style={{ color: ACCENT }} />
              <span className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {cargo?.name ?? 'Sem cargo definido'}
              </span>
            </div>
            {perms.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {perms.map(p => (
                  <div key={p.permission} className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full shrink-0" style={{ background: ACCENT }} />
                    <span className="text-[#777] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {PERMISSAO_LABEL[p.permission] ?? p.permission}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Sem permissões específicas definidas.
              </p>
            )}
          </div>

          {quemConvidou && (
            <p className="text-[#444] text-xs mb-5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Convite enviado por <span className="text-[#666]">{quemConvidou}</span>
            </p>
          )}

          {/* Botões */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onResponder('recusar')}
              disabled={respondendo}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium border transition-colors hover:border-red-400/40 hover:text-red-400 disabled:opacity-50"
              style={{ borderColor: '#222', color: '#555', fontFamily: 'var(--font-dm-sans)' }}
            >
              {respondendo
                ? <Loader2 size={13} className="animate-spin" />
                : <X size={13} />
              }
              Recusar
            </button>
            <button
              type="button"
              onClick={() => onResponder('aceitar')}
              disabled={respondendo}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold text-[#070707] transition-all hover:brightness-110 disabled:opacity-50"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
            >
              {respondendo
                ? <Loader2 size={13} className="animate-spin" />
                : <Check size={13} />
              }
              Aceitar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Atalhos por permissão ─────────────────────────────────────────────────────

const ATALHOS: {
  perm: string
  label: string
  desc: string
  icon: React.ElementType
  href: (eventoId: string) => string
  cor: string
}[] = [
  {
    perm:  'vender_ingresso',
    label: 'Abrir caixa',
    desc:  'Vender ingressos presencialmente',
    icon:  ShoppingCart,
    href:  (id) => `/bilheteria/${id}`,
    cor:   '#E8B84B',
  },
  {
    perm:  'validar_ingresso',
    label: 'Scanner',
    desc:  'Escanear e validar ingressos na entrada',
    icon:  ScanQrCode,
    href:  (id) => `/scanner/${id}`,
    cor:   '#4ade80',
  },
  {
    perm:  'ver_lista_convidados',
    label: 'Lista de compradores',
    desc:  'Ver quem comprou ingresso',
    icon:  ClipboardList,
    href:  (id) => `/dashboard/${id}`,
    cor:   '#60a5fa',
  },
  {
    perm:  'ver_relatorios',
    label: 'Relatórios',
    desc:  'Ver vendas e presença',
    icon:  BarChart2,
    href:  (id) => `/dashboard/${id}`,
    cor:   '#a78bfa',
  },
]

// ── Modal de trabalho confirmado ──────────────────────────────────────────────

function ModalTrabalho({
  registro,
  onFechar,
}: {
  registro: Registro
  onFechar: () => void
}) {
  const evento = registro.events
  const cargo  = registro.event_positions
  const perms  = new Set((cargo?.event_position_permissions ?? []).map(p => p.permission))

  const atalhos = ATALHOS.filter(a => perms.has(a.perm))
    .filter((a, i, arr) => arr.findIndex(b => b.href(evento?.id ?? '') === a.href(evento?.id ?? '')) === i)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onFechar])

  function formatarData(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#0d0d0d', border: '1px solid #1e1e1e' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #4ade80, transparent)' }} />

        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={14} className="text-green-400" />
                <span className="text-green-400 text-[10px] uppercase tracking-widest font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Confirmado
                </span>
              </div>
              <p className="text-white text-lg font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
                {evento?.title ?? 'Evento'}
              </p>
            </div>
            <button type="button" onClick={onFechar}>
              <X size={16} className="text-[#444] hover:text-white" />
            </button>
          </div>

          <div className="flex flex-col gap-1 mb-4">
            {evento?.date_start && (
              <span className="flex items-center gap-1.5 text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <Calendar size={11} />
                {formatarData(evento.date_start)}
              </span>
            )}
            {(evento?.venue_name || evento?.city) && (
              <span className="flex items-center gap-1.5 text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <MapPin size={11} />
                {[evento.venue_name, evento.city, evento.state].filter(Boolean).join(', ')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-5" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
            <Shield size={12} style={{ color: '#E8B84B' }} />
            <span className="text-white text-xs font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {cargo?.name ?? 'Sem cargo'}
            </span>
          </div>

          {atalhos.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-[#444] text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Seu acesso neste evento
              </p>
              {atalhos.map(a => {
                const Icon = a.icon
                return (
                  <a
                    key={a.perm}
                    href={a.href(evento?.id ?? '')}
                    className="flex items-center justify-between px-4 py-3.5 rounded-xl transition-all hover:brightness-110"
                    style={{ background: `${a.cor}10`, border: `1px solid ${a.cor}25` }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${a.cor}15` }}
                      >
                        <Icon size={15} style={{ color: a.cor }} />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          {a.label}
                        </p>
                        <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          {a.desc}
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={14} style={{ color: a.cor }} />
                  </a>
                )
              })}
            </div>
          ) : (
            <p className="text-[#444] text-sm text-center py-4" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Nenhum acesso específico configurado para sua função.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function TrabalhosClient({ registros }: Props) {
  const router = useRouter()
  const [conviteSelecionado, setConviteSelecionado] = useState<Registro | null>(null)
  const [respondendo,        setRespondendo]        = useState(false)

  const pendentes = registros.filter(r => r.status === 'pending')
  const ativos    = registros.filter(r => r.status === 'active')

  async function responder(acao: 'aceitar' | 'recusar') {
    if (!conviteSelecionado) return
    setRespondendo(true)
    try {
      await fetch('/api/trabalhos/responder', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ staffId: conviteSelecionado.id, acao }),
      })
      setConviteSelecionado(null)
      router.refresh()
    } finally {
      setRespondendo(false)
    }
  }

  function formatarData(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  }

  if (registros.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-20 rounded-2xl text-center"
        style={{ border: '1px solid #1a1a1a', background: '#0a0a0a' }}
      >
        <Briefcase size={32} className="text-[#222] mb-3" />
        <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Nenhum convite ou trabalho ativo no momento.
        </p>
        <p className="text-[#333] text-xs mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Quando um organizador te convidar para a equipe, vai aparecer aqui.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Modal de convite pendente */}
      {conviteSelecionado && (
        <ModalConvite
          registro={conviteSelecionado}
          onFechar={() => !respondendo && setConviteSelecionado(null)}
          onResponder={responder}
          respondendo={respondendo}
        />
      )}

      <div className="flex flex-col gap-8">

        {/* ── Convites pendentes ── */}
        {pendentes.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
              >
                Convites pendentes
              </span>
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-[#070707]"
                style={{ background: ACCENT }}
              >
                {pendentes.length}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {pendentes.map(r => {
                const evento = r.events
                const cargo  = r.event_positions

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setConviteSelecionado(r)}
                    className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-left transition-all hover:border-[#E8B84B]/30"
                    style={{ background: '#0a0a0a', border: `1px solid ${ACCENT}20` }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${ACCENT}12`, border: `1px solid ${ACCENT}20` }}
                      >
                        <Bell size={14} style={{ color: ACCENT }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          {evento?.title ?? 'Evento'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                            {cargo?.name ?? 'Sem cargo'}
                          </span>
                          {evento?.date_start && (
                            <>
                              <span className="text-[#333]">·</span>
                              <span className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                                {formatarData(evento.date_start)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-lg shrink-0 ml-3"
                      style={{ background: `${ACCENT}12`, color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
                    >
                      Ver convite
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Trabalhos confirmados ── */}
        {ativos.length > 0 && (
          <section>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ color: '#444', fontFamily: 'var(--font-dm-sans)' }}
            >
              Trabalhos confirmados
            </p>

            <div className="flex flex-col gap-3">
              {ativos.map(r => {
                const evento = r.events
                const cargo  = r.event_positions

                return (
                  <a
                    key={r.id}
                    href={`/trabalho/${r.events?.id ?? ''}`}
                    className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-left transition-colors hover:border-[#2a2a2a]"
                    style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          {evento?.title ?? 'Evento'}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                            {cargo?.name ?? 'Sem cargo'}
                          </span>
                          {evento?.date_start && (
                            <span className="text-[#333] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                              {formatarData(evento.date_start)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-[#333] shrink-0" />
                  </a>
                )
              })}
            </div>
          </section>
        )}

      </div>
    </>
  )
}
