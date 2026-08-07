import { getAuthUser } from '@/lib/auth/server'
import { getAdminMember, temAcessoRestrito } from '@/lib/adminAuth'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect } from 'next/navigation'
import { EquipeClient } from './EquipeClient'
import { AreaRestritaWatcher } from '@/app/admin/area-restrita/AreaRestritaWatcher'

interface RowApi {
  id: string; userId: string; nome: string; role: string
  permissions: string[]; createdAt: string; isMe: boolean
}

export default async function EquipePage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth')

  const me = await getAdminMember(user.id)
  if (!me || !temAcessoRestrito(me)) redirect('/admin')
  const statusRes = await apiFetchServer('/api/admin/area-restrita/status')
  const { desbloqueada } = statusRes.ok ? await statusRes.json() as { desbloqueada: boolean } : { desbloqueada: false }
  if (!desbloqueada) redirect(`/admin/area-restrita?next=${encodeURIComponent('/admin/equipe')}`)

  const equipeRes = await apiFetchServer('/api/admin/equipe')
  const { rows } = equipeRes.ok ? await equipeRes.json() as { rows: RowApi[] } : { rows: [] as RowApi[] }

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
