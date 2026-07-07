import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SegundaTelaClient } from './SegundaTelaClient'

interface Props {
  params: Promise<{ eventoId: string }>
}

export default async function SegundaTelaPage({ params }: Props) {
  const { eventoId } = await params
  const supabase     = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?next=/segunda-tela/${eventoId}`)

  const admin = createServiceClient()

  const { data: evento } = await admin
    .from('events')
    .select('id, title, date_start, venue_name, city, state, organization_id')
    .eq('id', eventoId)
    .single()

  // Próximos eventos da mesma organização (publicidade da casa/promotor)
  const { data: proximos } = await admin
    .from('events')
    .select('id, title, date_start, venue_name, city, cover_url')
    .eq('organization_id', evento?.organization_id ?? '')
    .eq('is_published', true)
    .gte('date_start', new Date().toISOString())
    .order('date_start', { ascending: true })
    .limit(10)

  return (
    <SegundaTelaClient
      eventoId={eventoId}
      eventoTitle={evento?.title ?? 'Evento'}
      eventosProximos={(proximos ?? []).map(e => ({
        id:         e.id,
        title:      e.title ?? '',
        date_start: e.date_start,
        local:      [e.venue_name, e.city].filter(Boolean).join(' — ') || null,
        cover_url:  e.cover_url ?? null,
      }))}
    />
  )
}
