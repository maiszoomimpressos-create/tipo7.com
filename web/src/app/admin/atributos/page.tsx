import { getAuthUser }                       from '@/lib/auth/server'
import { getAdminMember }                   from '@/lib/adminAuth'
import { apiFetchServer }                    from '@/lib/apiFetchServer'
import { redirect }                          from 'next/navigation'
import { AtributosClient }                   from './AtributosClient'

export default async function AtributosPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth')

  // Apenas super_admin pode acessar esta página (mesma regra da página Conteúdo)
  const me = await getAdminMember(user.id)
  if (!me || me.role !== 'super_admin') redirect('/admin')

  const res = await apiFetchServer('/api/admin/atributos')
  const { atributos } = res.ok ? await res.json() as { atributos: unknown[] } : { atributos: [] as unknown[] }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Atributos de Evento
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Gerencie os atributos que os promotores podem ativar nos seus eventos
        </p>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <AtributosClient atributos={atributos as any} />
    </div>
  )
}
