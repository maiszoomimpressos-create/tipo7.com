'use client'

import { useState } from 'react'
import {
  ArrowLeft, Calendar, MapPin, Shield,
  ShoppingCart, CheckCircle2, ChevronRight, Ticket, KeyRound,
} from 'lucide-react'
import { TrabalhoDashboard } from './TrabalhoDashboard'
import { BlocoTokenPin, type AcessoCaixa } from '@/components/BlocoTokenPin'
import { buildAcessos } from '@/lib/buildAcessos'

const ACCENT = '#E8B84B'

interface Ingresso {
  id:         string
  name:       string
  price:      number
  total:      number
  vendidos:   number
  disponivel: number
}

interface Props {
  eventoId:       string
  eventoTitle:    string
  eventoDate:     string | null
  eventoLocal:    string
  eventoBanner:   string | null
  cargoNome:      string
  permissoes:     string[]
  ingressos:      Ingresso[]
  isOwner:        boolean
  // estacionamentoId: achado real (21/08/2026) — o card "Seu caixa" sempre
  // linkava pra tela de VENDER INGRESSO, mesmo quando o caixa é o do
  // estacionamento (mesma tabela `caixa`, só muda esse campo). Quem só tem
  // função de estacionamento caía na tela errada. Ver caixaHref abaixo.
  caixaDesignado: { id: string; nome: string; estacionamentoId: string | null } | null
  // Token+PIN de acesso (rota /caixa) — null se essa pessoa nunca aceitou
  // convite nem abriu caixa como dono neste evento (ninguém pra mostrar).
  acessoCaixa:    AcessoCaixa | null
}

export function TrabalhoClient({
  eventoId, eventoTitle, eventoDate, eventoLocal, eventoBanner,
  cargoNome, permissoes, ingressos, isOwner, caixaDesignado, acessoCaixa,
}: Props) {
  const [pinDefinido, setPinDefinido] = useState(acessoCaixa?.pinDefinido ?? false)
  const [verAcesso, setVerAcesso]     = useState(false)

  const caixaHref = caixaDesignado
    ? (caixaDesignado.estacionamentoId ? `/estacionamento/${eventoId}` : `/bilheteria/${eventoId}/caixa/${caixaDesignado.id}`)
    : null

  // Achado do usuário (25/08/2026): "Seu caixa" e a ferramenta correspondente
  // (Bilheteria ou Estacionamento) levavam pro MESMO link quando o caixa
  // designado é de estacionamento — apareciam os 2 cards duplicados, sem
  // indicar em nenhum dos dois se tinha dinheiro/status. Antes só filtrava
  // o caso de Bilheteria (comparando a permissão); generalizado pra
  // comparar o destino em si — qualquer ferramenta que já leve pra onde
  // "Seu caixa" leva não precisa aparecer de novo solta.
  const acessos = buildAcessos(eventoId, permissoes, isOwner)
    .filter(a => a.href !== caixaHref)

  // Lista de tipos de ingresso só faz sentido pra quem vende (ou pro
  // organizador). Quem é só estacionamento/scanner não precisa ver isso.
  const podeVerIngressos = isOwner || permissoes.includes('vender_ingresso')

  const dataFormatada = eventoDate
    ? new Date(eventoDate).toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div className="flex min-h-[calc(100dvh-64px)]">

      {/* ── SIDEBAR (desktop) ────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col gap-4 w-72 shrink-0 px-5 py-6 sticky top-16 h-[calc(100dvh-64px)] overflow-y-auto"
        style={{ borderRight: '1px solid #111', background: '#070707' }}
      >
        {/* Voltar */}
        <a
          href="/trabalhos"
          className="flex items-center gap-2 text-sm text-[#444] hover:text-white transition-colors w-fit"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          <ArrowLeft size={13} />
          Meus trabalhos
        </a>

        {/* Card do evento */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1a1a1a', background: '#0d0d0d' }}>
          {eventoBanner ? (
            <div className="h-28 w-full bg-cover bg-center" style={{ backgroundImage: `url(${eventoBanner})` }} />
          ) : (
            <div className="h-14 w-full" style={{ background: 'linear-gradient(135deg, #111 0%, #1a1a0f 100%)' }} />
          )}
          <div className="px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <CheckCircle2 size={10} className="text-green-400" />
              <span className="text-green-400 text-[9px] font-semibold uppercase tracking-widest" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Confirmado
              </span>
            </div>
            <h1 className="text-white text-sm font-semibold mb-2 leading-snug" style={{ fontFamily: 'var(--font-outfit)' }}>
              {eventoTitle}
            </h1>
            <div className="flex flex-col gap-1">
              {dataFormatada && (
                <div className="flex items-center gap-1.5 text-[#555] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  <Calendar size={10} />
                  <span>{dataFormatada}</span>
                </div>
              )}
              {eventoLocal && (
                <div className="flex items-center gap-1.5 text-[#555] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  <MapPin size={10} />
                  <span>{eventoLocal}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sua função */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
          style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}18` }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${ACCENT}15` }}>
            <Shield size={12} style={{ color: ACCENT }} />
          </div>
          <div>
            <p className="text-[#666] text-[9px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Sua função
            </p>
            <p className="text-white text-xs font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {cargoNome}
            </p>
          </div>
        </div>

        {/* Token+PIN de acesso ao caixa (rota /caixa) */}
        {acessoCaixa && (
          <button
            type="button"
            onClick={() => setVerAcesso(true)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors hover:brightness-110"
            style={{ background: '#111', border: '1px solid #1e1e1e' }}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${ACCENT}15` }}>
              <KeyRound size={12} style={{ color: ACCENT }} />
            </div>
            <div>
              <p className="text-[#666] text-[9px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Acesso ao caixa
              </p>
              <p className="text-white text-xs font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Ver token/PIN
              </p>
            </div>
          </button>
        )}

        {/* Caixa designado */}
        {caixaDesignado && (
          <a
            href={caixaHref!}
            className="flex items-center justify-between px-3 py-3 rounded-xl transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}30` }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${ACCENT}15` }}>
                <ShoppingCart size={12} style={{ color: ACCENT }} />
              </div>
              <div>
                <p className="text-[#666] text-[9px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Seu caixa
                </p>
                <p className="text-white text-xs font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {caixaDesignado.nome}
                </p>
              </div>
            </div>
            <ChevronRight size={13} style={{ color: ACCENT + '70' }} />
          </a>
        )}

        {/* Navegação */}
        {acessos.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[#333] text-[9px] uppercase tracking-wider px-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Ferramentas
            </p>
            {acessos.map(a => {
              const Icon = a.icon
              return (
                <a
                  key={a.href}
                  href={a.href}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ background: `${a.cor}08`, border: `1px solid ${a.cor}18` }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${a.cor}12` }}>
                    <Icon size={14} style={{ color: a.cor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {a.label}
                    </p>
                    <p className="text-[#444] text-[10px] truncate mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {a.desc}
                    </p>
                  </div>
                  <ChevronRight size={12} style={{ color: a.cor + '60' }} />
                </a>
              )
            })}
          </div>
        )}
      </aside>

      {/* ── CONTEÚDO PRINCIPAL ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Layout mobile (coluna, igual ao anterior) */}
        <div className="md:hidden max-w-lg mx-auto px-5 py-8 flex flex-col gap-5">

          {/* Voltar */}
          <a
            href="/trabalhos"
            className="flex items-center gap-2 text-sm text-[#555] hover:text-white transition-colors w-fit"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            <ArrowLeft size={14} />
            Meus trabalhos
          </a>

          {/* Card do evento */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1e1e1e', background: '#0d0d0d' }}>
            {eventoBanner ? (
              <div className="h-36 w-full bg-cover bg-center" style={{ backgroundImage: `url(${eventoBanner})` }} />
            ) : (
              <div className="h-20 w-full" style={{ background: 'linear-gradient(135deg, #111 0%, #1a1a0f 100%)' }} />
            )}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-2">
                <CheckCircle2 size={12} className="text-green-400" />
                <span className="text-green-400 text-[10px] font-semibold uppercase tracking-widest" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Confirmado
                </span>
              </div>
              <h1 className="text-white text-xl font-semibold mb-3 leading-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
                {eventoTitle}
              </h1>
              <div className="flex flex-col gap-1.5">
                {dataFormatada && (
                  <div className="flex items-center gap-2 text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    <Calendar size={13} />
                    <span>{dataFormatada}</span>
                  </div>
                )}
                {eventoLocal && (
                  <div className="flex items-center gap-2 text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    <MapPin size={13} />
                    <span>{eventoLocal}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Caixa designado */}
          {caixaDesignado && (
            <a
              href={caixaHref!}
              className="flex items-center justify-between px-4 py-4 rounded-2xl transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}35` }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${ACCENT}15` }}>
                  <ShoppingCart size={18} style={{ color: ACCENT }} />
                </div>
                <div>
                  <p className="text-[#888] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Seu caixa designado
                  </p>
                  <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {caixaDesignado.nome}
                  </p>
                </div>
              </div>
              <ChevronRight size={16} style={{ color: ACCENT + '80' }} />
            </a>
          )}

          {/* Sua função */}
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}20` }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${ACCENT}15` }}>
              <Shield size={14} style={{ color: ACCENT }} />
            </div>
            <div>
              <p className="text-[#888] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Sua função
              </p>
              <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {cargoNome}
              </p>
            </div>
          </div>

          {/* Token+PIN de acesso ao caixa (rota /caixa, mobile) */}
          {acessoCaixa && (
            <button
              type="button"
              onClick={() => setVerAcesso(true)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors hover:brightness-110"
              style={{ background: '#111', border: '1px solid #1e1e1e' }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${ACCENT}15` }}>
                <KeyRound size={14} style={{ color: ACCENT }} />
              </div>
              <div>
                <p className="text-[#888] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Acesso ao caixa
                </p>
                <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Ver token/PIN
                </p>
              </div>
            </button>
          )}

          {/* Acessos (mobile) */}
          {acessos.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-[#444] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Seu acesso neste evento
              </p>
              {acessos.map(a => {
                const Icon = a.icon
                return (
                  <a
                    key={a.href}
                    href={a.href}
                    className="flex items-center justify-between px-4 py-4 rounded-2xl transition-all hover:brightness-110 active:scale-[0.98]"
                    style={{ background: `${a.cor}08`, border: `1px solid ${a.cor}20` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${a.cor}15` }}>
                        <Icon size={18} style={{ color: a.cor }} />
                      </div>
                      <div>
                        <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          {a.label}
                        </p>
                        <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          {a.desc}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: a.cor + '80' }} />
                  </a>
                )
              })}
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center py-10 rounded-2xl text-center"
              style={{ border: '1px solid #1a1a1a', background: '#0a0a0a' }}
            >
              <Shield size={24} className="text-[#222] mb-3" />
              <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Nenhuma ferramenta configurada para sua função.
              </p>
              <p className="text-[#333] text-xs mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Fale com o organizador do evento.
              </p>
            </div>
          )}

          {/* Dashboard (mobile, só para owner) */}
          {isOwner && <TrabalhoDashboard eventoId={eventoId} />}

          {/* Ingressos (mobile) — só pra quem vende */}
          {ingressos.length > 0 && !isOwner && podeVerIngressos && (
            <IngressosSection ingressos={ingressos} />
          )}
        </div>

        {/* Layout desktop (conteúdo da direita) */}
        <div className="hidden md:block max-w-3xl mx-auto px-8 py-8">
          {isOwner ? (
            <TrabalhoDashboard eventoId={eventoId} />
          ) : (
            <div className="flex flex-col gap-6">
              {ingressos.length > 0 && podeVerIngressos && <IngressosSection ingressos={ingressos} />}
              {acessos.length === 0 && (
                <div
                  className="flex flex-col items-center justify-center py-16 rounded-2xl text-center"
                  style={{ border: '1px solid #1a1a1a', background: '#0a0a0a' }}
                >
                  <Shield size={28} className="text-[#222] mb-3" />
                  <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Nenhuma ferramenta configurada para sua função.
                  </p>
                  <p className="text-[#333] text-xs mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Fale com o organizador do evento.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {verAcesso && acessoCaixa && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}
          onClick={() => setVerAcesso(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden p-5"
            style={{ background: '#0d0d0d', border: `1px solid ${ACCENT}30` }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-white text-sm font-medium mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {eventoTitle}
            </p>
            <BlocoTokenPin
              acesso={{ ...acessoCaixa, pinDefinido }}
              onPinAtualizado={() => setPinDefinido(true)}
            />
            <button
              type="button" onClick={() => setVerAcesso(false)}
              className="w-full mt-3 py-3 rounded-xl text-sm font-medium border transition-colors hover:border-[#E8B84B]/40"
              style={{ borderColor: '#222', color: '#888', fontFamily: 'var(--font-dm-sans)' }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function IngressosSection({ ingressos }: { ingressos: Ingresso[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Ticket size={13} style={{ color: ACCENT }} />
        <p className="text-[#444] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Tipos de ingresso
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {ingressos.map(i => {
          const pct      = i.total > 0 ? Math.round((i.vendidos / i.total) * 100) : 0
          const esgotado = i.disponivel === 0
          return (
            <div
              key={i.id}
              className="px-4 py-3.5 rounded-xl"
              style={{
                background: '#0d0d0d',
                border:     `1px solid ${esgotado ? '#1a1a1a' : '#1e1e1e'}`,
                opacity:    esgotado ? 0.5 : 1,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {i.name}
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold" style={{ color: ACCENT, fontFamily: 'var(--font-outfit)' }}>
                    {i.price === 0 ? 'Grátis' : `R$ ${i.price.toFixed(2).replace('.', ',')}`}
                  </span>
                  {esgotado && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: '#1a1a1a', color: '#444', fontFamily: 'var(--font-dm-sans)' }}
                    >
                      Esgotado
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width:      `${pct}%`,
                      background: pct >= 90 ? '#f87171' : pct >= 60 ? ACCENT : '#4ade80',
                    }}
                  />
                </div>
                <span className="text-[#555] text-[10px] shrink-0" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {i.disponivel} disponíveis
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
