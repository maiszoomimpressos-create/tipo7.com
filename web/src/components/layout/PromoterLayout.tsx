'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CalendarRange, Settings2, Landmark, ReceiptText,
  ChevronDown, Megaphone, GalleryHorizontal, Building2, Users, Briefcase,
  ShoppingBag, CircleDot, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetchAuth } from '@/lib/apiFetch'

const MARKETING_SUB = [
  { label: 'Carrossel', href: '/minha-area/marketing/carrossel', icon: GalleryHorizontal },
]

// Organizações virou submenu — Sócios concentra tudo que já existia
// (CNPJ, endereço, logo, convites de sócio); Colaboradores é o painel
// novo que qualquer sócio vê, com os pedidos de equipe mandados pra
// eventos das organizações que administra.
const ORGANIZACOES_SUB = [
  { label: 'Sócios',        href: '/configuracoes/organizacoes',   icon: Users     },
  { label: 'Colaboradores', href: '/configuracoes/colaboradores',  icon: Briefcase },
]

const CONFIG_SUB = [
  { label: 'Contas',  href: '/configuracoes/contas', icon: Landmark    },
  { label: 'Tarifas', href: '/minha-area/tarifas',   icon: ReceiptText },
]

// Só os campos que o popover de Bilheteria usa — a API devolve bem mais
// (ver listPorEvento em caixas.service.ts).
interface CaixaResumo {
  id:             string
  nome:           string
  status:         string
  operadorName:   string | null
  totalVendas:    number
  saldoIngressos: number
}

export function PromoterLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const inOrganizacoes = ORGANIZACOES_SUB.some(s => pathname.startsWith(s.href))
  const inConfig    = CONFIG_SUB.some(s => pathname.startsWith(s.href)) || inOrganizacoes
  const inMarketing = pathname.startsWith('/minha-area/marketing')
  const inEventos   = pathname.startsWith('/criar-evento') || inMarketing

  const [openEventos,      setOpenEventos]      = useState(inEventos)
  const [openMarketing,    setOpenMarketing]    = useState(inMarketing)
  const [openConfig,       setOpenConfig]       = useState(inConfig)
  const [openOrganizacoes, setOpenOrganizacoes] = useState(inOrganizacoes)

  const dashActive = pathname === '/minha-area'

  // Botão "Bilheteria" no sidebar (pedido do usuário, 10/08/2026 — fica
  // nos dois lugares: aqui E ao lado do "Novo evento" em Minha Área).
  // PromoterLayout não recebe a lista de eventos como prop (é usado em
  // várias páginas diferentes), então busca sozinho, uma vez, ao montar.
  const [eventosBilheteria, setEventosBilheteria] = useState<{ id: string; title: string }[]>([])
  const [bilheteriaAberta,  setBilheteriaAberta]  = useState(false)
  const [eventoSel,         setEventoSel]         = useState('')
  const bilheteriaRef = useRef<HTMLDivElement>(null)

  // Caixas abertos do evento selecionado (pedido do usuário, 10/08/2026) —
  // mesma ideia do popover de Minha Área: mostra quem já tá vendendo, com
  // atalho direto pro caixa em vez de sempre passar pela tela de escolher.
  const [caixasAbertos,    setCaixasAbertos]    = useState<CaixaResumo[] | null>(null)
  const [carregandoCaixas, setCarregandoCaixas] = useState(false)

  useEffect(() => {
    apiFetchAuth('/api/eventos/meus')
      .then(res => res.ok ? res.json() : null)
      .then((d: { eventos?: { id: string; title: string }[] } | null) => setEventosBilheteria(d?.eventos ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!eventoSel) { setCaixasAbertos(null); return }
    setCarregandoCaixas(true)
    apiFetchAuth(`/api/eventos/${eventoSel}/caixas`)
      .then(res => res.ok ? res.json() : [])
      .then((lista: CaixaResumo[]) => setCaixasAbertos(lista.filter(c => c.status === 'aberto')))
      .catch(() => setCaixasAbertos([]))
      .finally(() => setCarregandoCaixas(false))
  }, [eventoSel])

  // Fecha o popover ao clicar fora (mesmo padrão de BilheteiroClient.tsx)
  useEffect(() => {
    function fecharFora(e: MouseEvent) {
      if (bilheteriaRef.current && !bilheteriaRef.current.contains(e.target as Node)) {
        setBilheteriaAberta(false)
      }
    }
    document.addEventListener('mousedown', fecharFora)
    return () => document.removeEventListener('mousedown', fecharFora)
  }, [])

  return (
    <div className="flex flex-1">

      {/* ── Sidebar desktop ───────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-52 shrink-0 sticky top-[60px] self-start bg-[#0a0a0a] border-r border-[#141414]"
        style={{ height: 'calc(100vh - 60px)' }}
      >
        <nav className="flex flex-col gap-0.5 p-3 pt-5">

          {/* Dashboard */}
          <a
            href="/minha-area"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
              dashActive && !inEventos
                ? 'bg-[#E8B84B]/10 text-[#E8B84B]'
                : 'text-[#555] hover:text-[#bbb] hover:bg-white/5'
            )}
            style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: dashActive && !inEventos ? 500 : 400 }}
          >
            <LayoutDashboard
              size={15}
              strokeWidth={2}
              className={dashActive && !inEventos ? 'text-[#E8B84B]' : 'text-[#3a3a3a]'}
            />
            Dashboard
          </a>

          {/* Bilheteria — abre popover pra escolher o evento (não é link
              direto, já que não tem um evento "atual" fixo aqui) */}
          <div className="relative" ref={bilheteriaRef}>
            <button
              type="button"
              onClick={() => setBilheteriaAberta(v => !v)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all w-full text-left text-[#555] hover:text-[#bbb] hover:bg-white/5"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              <ShoppingBag size={15} strokeWidth={2} className="text-[#3a3a3a]" />
              <span className="flex-1">Bilheteria</span>
            </button>
            {bilheteriaAberta && (
              <div
                className="absolute left-0 top-full mt-1 w-64 rounded-2xl p-4 flex flex-col gap-3 z-30"
                style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
              >
                <p className="text-[#666] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Escolha o evento
                </p>
                {eventosBilheteria.length === 0 ? (
                  <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Nenhum evento ainda.
                  </p>
                ) : (
                  <>
                    <select
                      value={eventoSel}
                      onChange={e => setEventoSel(e.target.value)}
                      className="w-full bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#E8B84B]/40"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    >
                      <option value="">Selecione o evento</option>
                      {eventosBilheteria.map(e => (
                        <option key={e.id} value={e.id}>{e.title}</option>
                      ))}
                    </select>

                    {eventoSel && (
                      <div className="flex flex-col gap-1.5">
                        {carregandoCaixas ? (
                          <div className="flex items-center gap-2 py-1 text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                            <Loader2 size={12} className="animate-spin" /> Carregando caixas...
                          </div>
                        ) : caixasAbertos && caixasAbertos.length > 0 ? (
                          <>
                            <p className="text-[#444] text-[10px] uppercase tracking-wider mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                              Caixas abertos
                            </p>
                            {caixasAbertos.map(c => (
                              <a
                                key={c.id}
                                href={`/bilheteria/${eventoSel}/caixa/${c.id}`}
                                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-colors hover:border-[#333]"
                                style={{ background: '#111', border: '1px solid #1e1e1e', fontFamily: 'var(--font-dm-sans)' }}
                              >
                                <span className="flex items-center gap-1.5 text-white font-medium truncate">
                                  <CircleDot size={9} className="text-green-400 shrink-0" />
                                  {c.nome}
                                </span>
                                <span className="text-[#666] shrink-0">
                                  R$ {c.totalVendas.toFixed(2).replace('.', ',')}
                                </span>
                              </a>
                            ))}
                          </>
                        ) : (
                          <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                            Nenhum caixa aberto nesse evento.
                          </p>
                        )}
                      </div>
                    )}

                    <a
                      href={eventoSel ? `/bilheteria/${eventoSel}` : undefined}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-[#070707] transition-opacity"
                      style={{
                        background: '#E8B84B', fontFamily: 'var(--font-dm-sans)',
                        opacity: eventoSel ? 1 : 0.4,
                        pointerEvents: eventoSel ? 'auto' : 'none',
                      }}
                    >
                      Ir pra bilheteria
                    </a>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Eventos — expansível */}
          <button
            onClick={() => setOpenEventos(v => !v)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all w-full text-left',
              inEventos
                ? 'bg-[#E8B84B]/10 text-[#E8B84B]'
                : 'text-[#555] hover:text-[#bbb] hover:bg-white/5'
            )}
            style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: inEventos ? 500 : 400 }}
          >
            <CalendarRange size={15} strokeWidth={2} className={inEventos ? 'text-[#E8B84B]' : 'text-[#3a3a3a]'} />
            <span className="flex-1">Eventos</span>
            <ChevronDown
              size={13}
              className={cn('text-[#3a3a3a] transition-transform duration-200', openEventos && 'rotate-180')}
            />
          </button>

          {openEventos && (
            <div className="ml-3 flex flex-col gap-0.5 border-l border-[#1c1c1c] pl-3">

              {/* Meus eventos */}
              {(() => {
                const active = pathname.startsWith('/criar-evento')
                return (
                  <a
                    href="/criar-evento"
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all',
                      active ? 'text-[#E8B84B]' : 'text-[#444] hover:text-[#bbb] hover:bg-white/5'
                    )}
                    style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: active ? 500 : 400 }}
                  >
                    <CalendarRange size={13} strokeWidth={2} className={active ? 'text-[#E8B84B]' : 'text-[#333]'} />
                    Meus eventos
                  </a>
                )
              })()}

              {/* Marketing — expansível (nível 2) */}
              <button
                onClick={() => setOpenMarketing(v => !v)}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all w-full text-left',
                  inMarketing ? 'text-[#E8B84B]' : 'text-[#444] hover:text-[#bbb] hover:bg-white/5'
                )}
                style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: inMarketing ? 500 : 400 }}
              >
                <Megaphone size={13} strokeWidth={2} className={inMarketing ? 'text-[#E8B84B]' : 'text-[#333]'} />
                <span className="flex-1">Marketing</span>
                <ChevronDown
                  size={11}
                  className={cn('text-[#3a3a3a] transition-transform duration-200', openMarketing && 'rotate-180')}
                />
              </button>

              {openMarketing && (
                <div className="ml-3 flex flex-col gap-0.5 border-l border-[#1c1c1c] pl-3">
                  {MARKETING_SUB.map(({ label, href, icon: Icon }) => {
                    const active = pathname.startsWith(href)
                    return (
                      <a
                        key={href}
                        href={href}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all',
                          active ? 'text-[#E8B84B]' : 'text-[#444] hover:text-[#bbb] hover:bg-white/5'
                        )}
                        style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: active ? 500 : 400 }}
                      >
                        <Icon size={12} strokeWidth={2} className={active ? 'text-[#E8B84B]' : 'text-[#333]'} />
                        {label}
                      </a>
                    )
                  })}
                </div>
              )}

            </div>
          )}

          {/* Configurar — expansível */}
          <button
            onClick={() => setOpenConfig(v => !v)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all w-full text-left',
              inConfig
                ? 'bg-[#E8B84B]/10 text-[#E8B84B]'
                : 'text-[#555] hover:text-[#bbb] hover:bg-white/5'
            )}
            style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: inConfig ? 500 : 400 }}
          >
            <Settings2 size={15} strokeWidth={2} className={inConfig ? 'text-[#E8B84B]' : 'text-[#3a3a3a]'} />
            <span className="flex-1">Configurar</span>
            <ChevronDown
              size={13}
              className={cn('text-[#3a3a3a] transition-transform duration-200', openConfig && 'rotate-180')}
            />
          </button>

          {openConfig && (
            <div className="ml-3 flex flex-col gap-0.5 border-l border-[#1c1c1c] pl-3">

              {/* Organizações — expansível (nível 2) */}
              <button
                onClick={() => setOpenOrganizacoes(v => !v)}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all w-full text-left',
                  inOrganizacoes ? 'text-[#E8B84B]' : 'text-[#444] hover:text-[#bbb] hover:bg-white/5'
                )}
                style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: inOrganizacoes ? 500 : 400 }}
              >
                <Building2 size={13} strokeWidth={2} className={inOrganizacoes ? 'text-[#E8B84B]' : 'text-[#333]'} />
                <span className="flex-1">Organizações</span>
                <ChevronDown
                  size={11}
                  className={cn('text-[#3a3a3a] transition-transform duration-200', openOrganizacoes && 'rotate-180')}
                />
              </button>

              {openOrganizacoes && (
                <div className="ml-3 flex flex-col gap-0.5 border-l border-[#1c1c1c] pl-3">
                  {ORGANIZACOES_SUB.map(({ label, href, icon: Icon }) => {
                    const active = pathname.startsWith(href)
                    return (
                      <a
                        key={href}
                        href={href}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all',
                          active ? 'text-[#E8B84B]' : 'text-[#444] hover:text-[#bbb] hover:bg-white/5'
                        )}
                        style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: active ? 500 : 400 }}
                      >
                        <Icon size={12} strokeWidth={2} className={active ? 'text-[#E8B84B]' : 'text-[#333]'} />
                        {label}
                      </a>
                    )
                  })}
                </div>
              )}

              {CONFIG_SUB.map(({ label, href, icon: Icon }) => {
                const active = pathname === href
                return (
                  <a
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all',
                      active
                        ? 'text-[#E8B84B]'
                        : 'text-[#444] hover:text-[#bbb] hover:bg-white/5'
                    )}
                    style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: active ? 500 : 400 }}
                  >
                    <Icon size={13} strokeWidth={2} className={active ? 'text-[#E8B84B]' : 'text-[#333]'} />
                    {label}
                  </a>
                )
              })}
            </div>
          )}

        </nav>
      </aside>

      {/* ── Conteúdo + tabs mobile ────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Tab bar horizontal — mobile */}
        <div className="md:hidden flex border-b border-[#141414] bg-[#0a0a0a]">
          <a
            href="/minha-area"
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 text-sm border-b-2 transition-all',
              dashActive && !inEventos
                ? 'text-[#E8B84B] border-[#E8B84B]'
                : 'text-[#555] border-transparent hover:text-[#bbb]'
            )}
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            <LayoutDashboard size={14} strokeWidth={2} />
            Dashboard
          </a>
          <a
            href="/criar-evento"
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 text-sm border-b-2 transition-all',
              inEventos
                ? 'text-[#E8B84B] border-[#E8B84B]'
                : 'text-[#555] border-transparent hover:text-[#bbb]'
            )}
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            <CalendarRange size={14} strokeWidth={2} />
            Eventos
          </a>
          <a
            href="/configuracoes/contas"
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 text-sm border-b-2 transition-all',
              inConfig
                ? 'text-[#E8B84B] border-[#E8B84B]'
                : 'text-[#555] border-transparent hover:text-[#bbb]'
            )}
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            <Settings2 size={14} strokeWidth={2} />
            Configurar
          </a>
        </div>

        {children}
      </div>
    </div>
  )
}
