'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Users, Calendar, DollarSign,
  Shield, FileText, ChevronDown, Landmark,
  ReceiptText,
} from 'lucide-react'
import type { AdminRole } from '@/lib/adminAuth'

const ACCENT = '#E8B84B'

const NAV = [
  { href: '/admin',            label: 'Início',     icon: LayoutDashboard, perm: null                   },
  { href: '/admin/promotores', label: 'Promotores', icon: Users,           perm: 'gerenciar_promotores' },
  { href: '/admin/eventos',    label: 'Eventos',    icon: Calendar,        perm: 'gerenciar_eventos'    },
  { href: '/admin/equipe',     label: 'Equipe',     icon: Shield,          perm: 'gerenciar_equipe'     },
  { href: '/admin/conteudo',   label: 'Conteúdo',   icon: FileText,        perm: 'super_admin_only'     },
]

const FIN_SUB = [
  { href: '/admin/financeiro',        label: 'Tarifas', icon: ReceiptText },
  { href: '/admin/financeiro/bancos', label: 'Bancos',  icon: Landmark    },
]

interface Props {
  role:        AdminRole
  permissions: string[]
  userName:    string
}

export function AdminSidebar({ role, permissions, userName }: Props) {
  const pathname = usePathname()
  const finOpen  = pathname.startsWith('/admin/financeiro')
  const [finExpanded, setFinExpanded] = useState(finOpen)

  function canSee(perm: string | null) {
    if (!perm) return true
    if (perm === 'super_admin_only') return role === 'super_admin'
    if (role === 'super_admin' || role === 'admin') return true
    return permissions.includes(perm)
  }

  const roleLabel = role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Admin' : 'Membro'

  return (
    <aside className="w-52 min-h-dvh flex flex-col shrink-0" style={{ background: '#0a0a0a', borderRight: '1px solid #141414' }}>

      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#141414]">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <p className="text-lg font-black" style={{ fontFamily: 'var(--font-syne)', color: ACCENT }}>tipo7</p>
        </Link>
        <p className="text-[#444] text-[10px] tracking-widest uppercase mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Painel Admin
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col gap-0.5">
        {NAV.filter(item => canSee(item.perm)).map(({ href, label, icon: Icon }) => {
          const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
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

        {/* Financeiro com submenu */}
        {canSee('gerenciar_financeiro') && (
          <div>
            <button
              type="button"
              onClick={() => setFinExpanded(v => !v)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
              style={{
                background: finOpen ? `${ACCENT}12` : 'transparent',
                color:      finOpen ? ACCENT : '#555',
                fontFamily: 'var(--font-dm-sans)',
                fontWeight: finOpen ? 600 : 400,
              }}
            >
              <DollarSign size={14} />
              <span className="flex-1 text-left">Financeiro</span>
              <ChevronDown
                size={13}
                className="transition-transform duration-200"
                style={{ transform: finExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {finExpanded && (
              <div className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l border-[#1c1c1c] pl-3">
                {FIN_SUB.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all"
                      style={{
                        background: active ? `${ACCENT}12` : 'transparent',
                        color:      active ? ACCENT : '#555',
                        fontFamily: 'var(--font-dm-sans)',
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      <Icon size={12} />
                      {label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Usuário */}
      <div className="p-4 border-t border-[#141414]">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-[#070707] shrink-0"
            style={{ background: ACCENT, fontFamily: 'var(--font-syne)' }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {userName.split(' ')[0]}
            </p>
            <p className="text-[#444] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>{roleLabel}</p>
          </div>
        </div>
      </div>

    </aside>
  )
}
