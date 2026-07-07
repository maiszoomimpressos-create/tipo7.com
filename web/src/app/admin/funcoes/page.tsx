import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember }                   from '@/lib/adminAuth'
import { redirect }                          from 'next/navigation'
import { FuncoesClient }                     from './FuncoesClient'

export default async function FuncoesAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const me = await getAdminMember(user.id)
  if (!me || me.role !== 'super_admin') redirect('/admin')

  const admin = createServiceClient()
  const { data } = await admin
    .from('staff_function_templates')
    .select('id, name, active, sort_order, staff_function_template_permissions(permission)')
    .order('sort_order')

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Funções de Equipe
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Funções globais disponíveis para promotores usarem ao montar a equipe dos eventos.
        </p>
      </div>
      <FuncoesClient funcoes={data ?? []} />
    </div>
  )
}
