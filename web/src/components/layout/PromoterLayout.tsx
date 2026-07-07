'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarRange, Settings2, Landmark, ReceiptText, ChevronDown, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'

const EVENTOS_SUB = [
  { label: 'Meus eventos', href: '/minha-area',          icon: CalendarRange },
  { label: 'Marketing',    href: '/minha-area/marketing', icon: Megaphone    },
]

const CONFIG_SUB = [
  { label: 'Contas',  href: '/configuracoes/contas', icon: Landmark    },
  { label: 'Tarifas', href: '/minha-area/tarifas',   icon: ReceiptText },
]

export function PromoterLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const inConfig  = CONFIG_SUB.some(s => pathname.startsWith(s.href))
  const inEventos = EVENTOS_SUB.some(s => pathname === s.href || pathname.startsWith(s.href + '/'))

  const [openEventos, setOpenEventos] = useState(inEventos)
  const [openConfig,  setOpenConfig]  = useState(inConfig)

  const dashActive = pathname === '/minha-area'

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
              {EVENTOS_SUB.map(({ label, href, icon: Icon }) => {
                const active = pathname === href || (href !== '/minha-area' && pathname.startsWith(href))
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
            href="/minha-area"
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
