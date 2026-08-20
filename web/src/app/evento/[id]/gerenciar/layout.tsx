import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect, notFound } from 'next/navigation'
import { GerenciarSidebar } from './GerenciarSidebar'

interface Props {
  params: Promise<{ id: string }>
  children: React.ReactNode
}

// Painel de gestão do evento (20/08/2026, pedido do usuário) — separado da
// página pública (/evento/[id]), que antes acumulava vitrine + gestão
// espremida numa coluna estreita ao lado do QR code. Mesmo padrão visual
// do /admin (sidebar fixa + área de conteúdo em largura cheia), só que
// escopado a um evento em vez do sistema inteiro.
export default async function GerenciarLayout({ params, children }: Props) {
  const { id } = await params

  const user = await getAuthUser()
  if (!user) redirect(`/auth?next=/evento/${id}/gerenciar`)

  const acessoRes = await apiFetchServer(`/api/eventos/${id}/meu-acesso`)
  if (!acessoRes.ok) notFound()
  const acesso = await acessoRes.json() as { evento: { id: string; title: string | null } | null; isOwner: boolean }
  if (!acesso.evento) notFound()
  if (!acesso.isOwner) redirect(`/evento/${id}`)

  return (
    <div className="min-h-dvh bg-[#070707] flex">
      <GerenciarSidebar eventoId={id} eventoTitle={acesso.evento.title ?? 'Evento'} />
      <main className="flex-1 min-h-dvh overflow-auto">
        {children}
      </main>
    </div>
  )
}
