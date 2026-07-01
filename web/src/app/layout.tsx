// Layout raiz da aplicação — envolve todas as páginas
// Define fontes, metadados e estrutura base do HTML
import type { Metadata } from 'next'
import { Syne, DM_Sans, Outfit } from 'next/font/google'
import { Providers } from '@/components/layout/Providers'
import './globals.css'

// Fonte de display — usada no logo e elementos de marca
// Syne: geométrica, forte personalidade
const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['600', '700', '800'],
  display: 'swap',
})

// Fonte de títulos — usada em nomes de eventos e headings
// Outfit: moderna, geométrica, limpa e sutil — leitura elegante
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
})

// Fonte de corpo — usada em toda a interface
// DM Sans: legível, profissional, neutra
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Tipo7 — Ingressos para os melhores eventos',
  description: 'Compre e venda ingressos para shows, festas, festivais e muito mais.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${syne.variable} ${outfit.variable} ${dmSans.variable}`}
    >
      <body className="min-h-dvh flex flex-col">
        {/* Providers envolve toda a app — disponibiliza AuthContext em todos os componentes */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
