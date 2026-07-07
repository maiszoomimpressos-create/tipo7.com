import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { TrabalhosClient } from './TrabalhosClient'

export default async function TrabalhosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/trabalhos')

  const admin = createServiceClient()

  const { data: staff } = await admin
    .from('event_staff')
    .select(`
      id, status, created_at,
      events:event_id (
        id, title, date_start, venue_name, city, state, banner_url
      ),
      event_positions:event_position_id (
        id, name,
        event_position_permissions ( permission )
      ),
      convidado_por:invited_by ( full_name )
    `)
    .eq('user_id', user.id)
    .in('status', ['pending', 'active'])
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-2xl text-white mb-1" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
            Trabalhos
          </h1>
          <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Convites de eventos e trabalhos nos quais você está escalado.
          </p>
        </div>

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <TrabalhosClient registros={(staff ?? []) as any} />
      </main>
    </div>
  )
}
