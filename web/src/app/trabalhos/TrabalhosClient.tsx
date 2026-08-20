'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Briefcase, Calendar, MapPin, Shield, Check, X,
  Loader2, Bell, Clock, KeyRound, CheckCircle2,
} from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'
import { BlocoTokenPin } from '@/components/BlocoTokenPin'

const ACCENT = '#E8B84B'

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
  // Acesso a caixa via token+PIN (20/08/2026) — ver
  // project_token_pin_acesso_caixa na memória. Só existe depois de aceitar
  // o convite (trabalhos.service.ts gera o token nesse momento).
  token: string | null
  pin_definido: boolean
}

interface Props {
  registros: Registro[]
}

// ── Modal de resposta ao convite ──────────────────────────────────────────────

function ModalConvite({
  registro,
  aceito,
  onFechar,
  onResponder,
  onPinAtualizado,
  respondendo,
}: {
  registro: Registro
  aceito: Registro | null
  onFechar: () => void
  onResponder: (acao: 'aceitar' | 'recusar') => void
  onPinAtualizado: () => void
  respondendo: boolean
}) {
  const evento = registro.events
  const cargo  = registro.event_positions
  const perms  = cargo?.event_position_permissions ?? []
  const quemConvidou = (registro.convidado_por as { full_name: string | null } | null)?.full_name

  const PERMISSAO_LABEL: Record<string, string> = {
    validar_ingresso:     'Validar ingressos',
    vender_ingresso:      'Bilheteria',
    ver_lista_convidados: 'Ver lista de compradores',
    ver_relatorios:       'Ver relatórios',
    gerenciar_checkin:    'Gerenciar check-in',
  }

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
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#0d0d0d', border: `1px solid ${ACCENT}30` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Faixa dourada topo */}
        <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }} />

        {/* Banner */}
        {evento?.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={evento.banner_url}
            alt={evento.title ?? 'Evento'}
            className="w-full h-36 object-cover"
          />
        ) : (
          <div className="w-full h-20 flex items-center justify-center" style={{ background: '#111' }}>
            <Briefcase size={24} className="text-[#2a2a2a]" />
          </div>
        )}

        <div className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Bell size={12} style={{ color: ACCENT }} />
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
              Convite para trabalhar
            </span>
          </div>

          <p className="text-white text-lg font-semibold mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
            {evento?.title ?? 'Evento'}
          </p>

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

          {aceito ? (
            <>
              <p className="flex items-center gap-1.5 text-green-400 text-sm font-medium mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <CheckCircle2 size={14} /> Convite aceito!
              </p>
              <BlocoTokenPin
                acesso={{ staffId: aceito.id, token: aceito.token, pinDefinido: aceito.pin_definido }}
                onPinAtualizado={onPinAtualizado}
              />
              <button
                type="button" onClick={onFechar}
                className="w-full mt-3 py-3 rounded-xl text-sm font-medium border transition-colors hover:border-[#E8B84B]/40"
                style={{ borderColor: '#222', color: '#888', fontFamily: 'var(--font-dm-sans)' }}
              >
                Fechar
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onResponder('recusar')}
                disabled={respondendo}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium border transition-colors hover:border-red-400/40 hover:text-red-400 disabled:opacity-50"
                style={{ borderColor: '#222', color: '#555', fontFamily: 'var(--font-dm-sans)' }}
              >
                {respondendo ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                Recusar
              </button>
              <button
                type="button"
                onClick={() => onResponder('aceitar')}
                disabled={respondendo}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold text-[#070707] transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
              >
                {respondendo ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Aceitar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Card de evento ────────────────────────────────────────────────────────────

function CardEvento({
  registro,
  onClick,
  onVerAcesso,
}: {
  registro: Registro
  onClick: () => void
  onVerAcesso?: () => void
}) {
  const evento  = registro.events
  const cargo   = registro.event_positions
  const ativo   = registro.status === 'active'

  function formatarData(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl overflow-hidden transition-all"
      style={{
        background: '#0d0d0d',
        border: ativo ? '1px solid #1e1e1e' : `1px solid ${ACCENT}18`,
        opacity: ativo ? 1 : 0.75,
      }}
    >
      {/* Banner com overlay para pendente */}
      <div className="relative w-full h-36 overflow-hidden">
        {evento?.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={evento.banner_url}
            alt={evento.title ?? 'Evento'}
            className="w-full h-full object-cover"
            style={{ filter: ativo ? 'none' : 'brightness(0.35) grayscale(0.4)' }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: '#111', filter: ativo ? 'none' : 'brightness(0.35)' }}
          >
            <Briefcase size={32} className="text-[#2a2a2a]" />
          </div>
        )}

        {/* Overlay gradiente sempre (ativo = leve, pendente = mais escuro) */}
        <div
          className="absolute inset-0"
          style={{
            background: ativo
              ? 'linear-gradient(to top, rgba(13,13,13,0.85) 0%, transparent 60%)'
              : 'linear-gradient(to top, rgba(7,7,7,0.95) 0%, rgba(0,0,0,0.6) 100%)',
          }}
        />

        {/* Badge de status */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {ativo && onVerAcesso && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onVerAcesso() }}
              title="Ver token/PIN de acesso ao caixa"
              className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:brightness-125"
              style={{ background: 'rgba(232,184,75,0.15)', border: `1px solid ${ACCENT}30` }}
            >
              <KeyRound size={12} style={{ color: ACCENT }} />
            </button>
          )}
          {ativo ? (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)', fontFamily: 'var(--font-dm-sans)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              Confirmado
            </span>
          ) : (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{ background: `rgba(232,184,75,0.15)`, color: ACCENT, border: `1px solid ${ACCENT}30`, fontFamily: 'var(--font-dm-sans)' }}
            >
              <Clock size={10} />
              Aguardando resposta
            </span>
          )}
        </div>

        {/* Mensagem de pendente no centro do banner */}
        {!ativo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', border: `1px solid ${ACCENT}20` }}
            >
              <Bell size={18} style={{ color: ACCENT }} />
              <p className="text-white text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Convite pendente
              </p>
              <p className="text-[#aaa] text-xs text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Toque para aceitar ou recusar
              </p>
            </div>
          </div>
        )}

        {/* Nome do evento no rodapé do banner */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
          <p
            className="text-white font-semibold text-base leading-tight truncate"
            style={{ fontFamily: 'var(--font-outfit)', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
          >
            {evento?.title ?? 'Evento'}
          </p>
        </div>
      </div>

      {/* Rodapé do card */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          {/* Cargo */}
          <div className="flex items-center gap-1.5">
            <Shield size={11} style={{ color: ACCENT }} />
            <span className="text-[#777] text-xs truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {cargo?.name ?? 'Sem cargo definido'}
            </span>
          </div>
          {/* Data e local */}
          <div className="flex items-center gap-3 flex-wrap">
            {evento?.date_start && (
              <span className="flex items-center gap-1 text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <Calendar size={10} />
                {formatarData(evento.date_start)}
              </span>
            )}
            {(evento?.city || evento?.venue_name) && (
              <span className="flex items-center gap-1 text-[#333] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <MapPin size={10} />
                {[evento.venue_name, evento.city].filter(Boolean).join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Seta ou ícone de ação */}
        {ativo ? (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: '#1a1a1a' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${ACCENT}12`, border: `1px solid ${ACCENT}25` }}
          >
            <Bell size={13} style={{ color: ACCENT }} />
          </div>
        )}
      </div>
    </button>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function TrabalhosClient({ registros }: Props) {
  const router = useRouter()
  const [conviteSelecionado, setConviteSelecionado] = useState<Registro | null>(null)
  const [respondendo,        setRespondendo]        = useState(false)
  // Preenchido só depois de "Aceitar" dar certo — troca os botões aceitar/
  // recusar pelo bloco de token+PIN dentro do MESMO modal, sem fechar.
  const [aceito, setAceito] = useState<Registro | null>(null)
  // Registro clicado numa aba já ativa (não pendente) — abre só a leitura do
  // token+PIN, sem fluxo de aceitar/recusar.
  const [verAcesso, setVerAcesso] = useState<Registro | null>(null)

  // Pendentes primeiro, depois ativos
  const ordenados = [
    ...registros.filter(r => r.status === 'pending'),
    ...registros.filter(r => r.status === 'active'),
  ]

  async function responder(acao: 'aceitar' | 'recusar') {
    if (!conviteSelecionado) return
    setRespondendo(true)
    try {
      const res  = await apiFetchAuth('/api/trabalhos/responder', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ staffId: conviteSelecionado.id, acao }),
      })
      const data = await res.json().catch(() => null) as { token?: string } | null
      if (acao === 'aceitar' && res.ok) {
        // Fica no modal mostrando o token — só fecha de fato quando o
        // usuário clicar "Fechar" no bloco de token+PIN.
        setAceito({ ...conviteSelecionado, status: 'active', token: data?.token ?? null, pin_definido: false })
        router.refresh()
      } else {
        setConviteSelecionado(null)
        router.refresh()
      }
    } finally {
      setRespondendo(false)
    }
  }

  function handleClick(registro: Registro) {
    if (registro.status === 'pending') {
      setConviteSelecionado(registro)
    } else if (registro.events?.id) {
      router.push(`/trabalho/${registro.events.id}`)
    }
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
      {conviteSelecionado && (
        <ModalConvite
          registro={conviteSelecionado}
          aceito={aceito}
          onFechar={() => {
            if (respondendo) return
            setConviteSelecionado(null)
            setAceito(null)
          }}
          onResponder={responder}
          onPinAtualizado={() => { router.refresh(); setAceito(a => a ? { ...a, pin_definido: true } : a) }}
          respondendo={respondendo}
        />
      )}

      {verAcesso && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}
          onClick={() => setVerAcesso(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden p-5"
            style={{ background: '#0d0d0d', border: `1px solid ${ACCENT}30` }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-white text-sm font-medium mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {verAcesso.events?.title ?? 'Evento'}
            </p>
            <BlocoTokenPin
              acesso={{ staffId: verAcesso.id, token: verAcesso.token, pinDefinido: verAcesso.pin_definido }}
              onPinAtualizado={() => { router.refresh(); setVerAcesso(v => v ? { ...v, pin_definido: true } : v) }}
            />
            <button
              type="button" onClick={() => setVerAcesso(null)}
              className="w-full mt-3 py-3 rounded-xl text-sm font-medium border transition-colors hover:border-[#E8B84B]/40"
              style={{ borderColor: '#222', color: '#888', fontFamily: 'var(--font-dm-sans)' }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {ordenados.map(r => (
          <CardEvento
            key={r.id}
            registro={r}
            onClick={() => handleClick(r)}
            onVerAcesso={r.status === 'active' ? () => setVerAcesso(r) : undefined}
          />
        ))}
      </div>
    </>
  )
}
