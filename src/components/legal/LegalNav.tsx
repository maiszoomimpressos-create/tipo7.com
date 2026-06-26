'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, Shield, Lock } from 'lucide-react'

const PAGES = [
  { href: '/termos',            label: 'Termos de Uso',          icon: FileText },
  { href: '/privacidade',       label: 'Política de Privacidade', icon: Lock     },
  { href: '/protecao-de-dados', label: 'Proteção de Dados',       icon: Shield   },
]

const ACCENT = '#E8B84B'

export function LegalNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-2 mb-10">
      {PAGES.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all"
            style={{
              background:  active ? `${ACCENT}15` : '#0d0d0d',
              color:       active ? ACCENT : '#555',
              border:      `1px solid ${active ? ACCENT + '40' : '#1a1a1a'}`,
              fontFamily:  'var(--font-dm-sans)',
              fontWeight:  active ? 600 : 400,
            }}
          >
            <Icon size={13} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
