import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/server'
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

  const admin = createServiceClient()
  const { data: row } = await admin
    .from('platform_team')
    .select('senha_restrita_hash')
    .eq('user_id', user.id)
    .single()

  // Só aceita caminho interno como destino pós-desbloqueio (evita open redirect)
  const isInternal = !!next && next.startsWith('/') && !next.startsWith('//')
  const destino     = isInternal ? next! : '/admin'

  return (
    <div className="min-h-dvh bg-[#070707] flex items-center justify-center px-4">
      <AreaRestritaClient temSenha={!!row?.senha_restrita_hash} destino={destino} />
    </div>
  )
}
