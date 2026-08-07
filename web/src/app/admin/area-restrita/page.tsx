import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect } from 'next/navigation'
import { getAdminMember, temAcessoRestrito } from '@/lib/adminAuth'
import { AreaRestritaClient } from './AreaRestritaClient'

interface Props {
  searchParams: Promise<{ next?: string }>
}

export default async function AreaRestritaPage({ searchParams }: Props) {
  const { next } = await searchParams
  const user = await getAuthUser()
  if (!user) redirect(`/auth?next=/admin/area-restrita${next ? `?next=${encodeURIComponent(next)}` : ''}`)

  const member = await getAdminMember(user.id)
  if (!member || !temAcessoRestrito(member)) redirect('/admin')

  // GET /admin/area-restrita/status agora também devolve temSenha (Fase
  // 7.2, G15) — não precisa mais ler platform_team.senha_restrita_hash direto.
  const statusRes = await apiFetchServer('/api/admin/area-restrita/status')
  const { temSenha } = statusRes.ok
    ? await statusRes.json() as { temSenha: boolean }
    : { temSenha: false }

  // Só aceita caminho interno como destino pós-desbloqueio (evita open redirect)
  const isInternal = !!next && next.startsWith('/') && !next.startsWith('//')
  const destino     = isInternal ? next! : '/admin'

  return (
    <div className="min-h-dvh bg-[#070707] flex items-center justify-center px-4">
      <AreaRestritaClient temSenha={temSenha} destino={destino} />
    </div>
  )
}
