import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/server'
import { getAdminMember, temAcessoRestrito } from '@/lib/adminAuth'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect } from 'next/navigation'
import { EquipeClient } from './EquipeClient'
import { AreaRestritaWatcher } from '@/app/admin/area-restrita/AreaRestritaWatcher'

export default async function EquipePage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth')

  const me = await getAdminMember(user.id)
  if (!me || !temAcessoRestrito(me)) redirect('/admin')
  const statusRes = await apiFetchServer('/api/admin/area-restrita/status')
  const { desbloqueada } = statusRes.ok ? await statusRes.json() as { desbloqueada: boolean } : { desbloqueada: false }
  if (!desbloqueada) redirect(`/admin/area-restrita?next=${encodeURIComponent('/admin/equipe')}`)

  const admin = createServiceClient()

  const { data: membros } = await admin
    .from('platform_team')
    .select('id, user_id, role, permissions, created_at, profiles ( full_name )')
    .order('created_at')

  const rows = (membros ?? []).map(m => {
    const profile = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as { full_name: string | null } | null
    return {
      id:          m.id as string,
      userId:      m.user_id as string,
      nome:        profile?.full_name ?? 'Sem nome',
      role:        m.role as string,
      permissions: m.permissions as string[],
      createdAt:   m.created_at as string,
      isMe:        m.user_id === user.id,
    }
  })

  return (
    <div className="p-8 max-w-3xl">
      <AreaRestritaWatcher currentPath="/admin/equipe" />
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Equipe
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Membros internos da plataforma Tipo7 e suas permissões
        </p>
      </div>
      <EquipeClient rows={rows} isSuperAdmin={me.role === 'super_admin'} />
    </div>
  )
}
