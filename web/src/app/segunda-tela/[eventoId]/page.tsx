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

  const orgId = evento?.organization_id ?? ''

  // Slides do carrossel cadastrados pelo promotor (têm prioridade)
  const { data: slidesRaw } = await admin
    .from('carrossel_slides')
    .select('id, image_url')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })

  const slides = (slidesRaw ?? []).map(s => ({
    id:        s.id        as string,
    image_url: s.image_url as string,
  }))

  // Próximos eventos da organização — usados como fallback quando não há slides
  const { data: proximos } = slides.length === 0
    ? await admin
        .from('events')
        .select('id, title, date_start, venue_name, city, cover_url')
        .eq('organization_id', orgId)
        .eq('is_published', true)
        .gte('date_start', new Date().toISOString())
        .order('date_start', { ascending: true })
        .limit(10)
    : { data: [] }

  return (
    <SegundaTelaClient
      eventoId={eventoId}
      eventoTitle={evento?.title ?? 'Evento'}
      slides={slides}
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
