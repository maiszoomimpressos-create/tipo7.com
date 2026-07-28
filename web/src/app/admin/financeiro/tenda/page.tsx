import { redirect }            from 'next/navigation'
import { createClient }        from '@/lib/supabase/server'
import { getAdminMember, can } from '@/lib/adminAuth'

export default async function TendaFinanceiroPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/admin/financeiro/tenda')

  const member = await getAdminMember(user.id)
  if (!member || !can(member, 'gerenciar_financeiro')) redirect('/admin')

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Tenda
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Tarifas e políticas de vendas na tenda
        </p>
      </div>

      <div
        className="rounded-2xl p-6 text-sm text-[#666]"
        style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', fontFamily: 'var(--font-dm-sans)' }}
      >
        Em construção — em breve as configurações específicas de tenda ficam aqui.
      </div>
    </div>
  )
}
