import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember } from '@/lib/adminAuth'
import { redirect } from 'next/navigation'
import { EquipeClient } from './EquipeClient'

export default async function EquipePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const me = await getAdminMember(user.id)
  if (!me || me.role !== 'super_admin') redirect('/admin')

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
