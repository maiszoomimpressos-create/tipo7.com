'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeft, Ticket, Layers, Users, Car, ShoppingBag, Settings,
  ExternalLink, BarChart2,
} from 'lucide-react'

const ACCENT = '#E8B84B'

interface Props {
  eventoId:    string
  eventoTitle: string
}

// Mesmo padrão visual de AdminSidebar.tsx (web/src/app/admin) — sidebar
// fixa + destaque de item ativo por pathname. Aqui escopado a um evento só,
// sem grupos/submenu (o painel do evento não tem profundidade suficiente
// pra precisar disso ainda).
export function GerenciarSidebar({ eventoId, eventoTitle }: Props) {
  const pathname = usePathname()
  const base = `/evento/${eventoId}/gerenciar`

  const NAV = [
    { href: `${base}/ingressos`,       label: 'Ingressos',      icon: Ticket },
    { href: `${base}/estrutura`,       label: 'Estrutura',      icon: Layers },
    { href: `${base}/equipe`,          label: 'Equipe',         icon: Users  },
    { href: `${base}/estacionamento`,  label: 'Estacionamento', icon: Car    },
    { href: `${base}/configuracoes`,   label: 'Configurações',  icon: Settings },
  ]

  const EXTERNOS = [
    { href: `/bilheteria/${eventoId}`,    label: 'Bilheteria (caixas)', icon: ShoppingBag },
    { href: `/dashboard/${eventoId}`,     label: 'Relatórios',          icon: BarChart2   },
  ]

  return (
    <aside className="w-56 min-h-dvh flex flex-col shrink-0" style={{ background: '#0a0a0a', borderRight: '1px solid #141414' }}>
      <div className="px-5 py-5 border-b border-[#141414]">
        <Link href={`/evento/${eventoId}`} className="flex items-center gap-1.5 text-[#555] text-xs hover:text-white transition-colors mb-3">
          <ArrowLeft size={12} /> Ver página pública
        </Link>
        <p className="text-white text-sm font-semibold truncate" style={{ fontFamily: 'var(--font-outfit)' }}>
          {eventoTitle}
        </p>
        <p className="text-[#444] text-[10px] tracking-widest uppercase mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Gerenciar evento
        </p>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
              style={{
                background: active ? `${ACCENT}12` : 'transparent',
                color:      active ? ACCENT : '#555',
                fontFamily: 'var(--font-dm-sans)',
                fontWeight: active ? 600 : 400,
              }}
            >
              <Icon size={14} />
              {label}
            </Link>
          )
        })}

        <div className="flex items-center gap-2 px-3 py-3">
          <div className="h-px flex-1" style={{ background: '#1c1c1c' }} />
        </div>

        {EXTERNOS.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-[#555] hover:text-white"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            <Icon size={14} />
            <span className="flex-1">{label}</span>
            <ExternalLink size={11} className="text-[#333]" />
          </a>
        ))}
      </nav>
    </aside>
  )
}
