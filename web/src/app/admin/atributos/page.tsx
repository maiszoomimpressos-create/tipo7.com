import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember }                   from '@/lib/adminAuth'
import { redirect }                          from 'next/navigation'
import { AtributosClient }                   from './AtributosClient'

export default async function AtributosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Apenas super_admin pode acessar esta página (mesma regra da página Conteúdo)
  const me = await getAdminMember(user.id)
  if (!me || me.role !== 'super_admin') redirect('/admin')

  // Busca todos os atributos (inclusive inativos) usando service client para bypass do RLS de write
  const admin = createServiceClient()
  const { data } = await admin
    .from('event_attributes')
    .select('id, name, icon, active, order_index')
    .order('order_index')

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
      <AtributosClient atributos={data ?? []} />
    </div>
  )
}
