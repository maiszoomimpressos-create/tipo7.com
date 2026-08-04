import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/server'
import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { ImagensClient } from './ImagensClient'
import { isOrgAdmin } from '@/lib/orgAdmin'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ImagensPage({ params }: Props) {
  const { id }   = await params
  const supabase = await createClient()

  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/criar-evento')

  const { data: evento } = await supabase
    .from('events')
    .select('id, title, date_start, venue_name, city, banner_url, gallery_urls, organization_id')
    .eq('id', id)
    .single()

  if (!evento) notFound()
  if (!(await isOrgAdmin(supabase, evento.organization_id, user.id))) notFound()

  // Se o promotor chegou direto nesta etapa (ex: pelo atalho "adicionar foto"
  // na tela de Informações) sem ter completado as etapas anteriores, o
  // "continuar" precisa voltar pra lá em vez de pular direto pra Publicar.
  const infoCompleta = !!evento.title && !!evento.date_start && !!(evento.venue_name || evento.city)
  const { count: ticketsCount } = await supabase
    .from('event_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', id)
  const ingressosCompleta = (ticketsCount ?? 0) > 0

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-12">

        <div className="mb-8">
          <h1 className="text-2xl text-white mb-1"
              style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
            Imagens do evento
          </h1>
          <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Adicione o banner e as fotos que vão aparecer na página do evento.
          </p>
        </div>

        <ImagensClient
          eventoId={id}
          infoCompleta={infoCompleta}
          ingressosCompleta={ingressosCompleta}
          bannerUrlInicial={evento.banner_url ?? null}
          galleryUrlsIniciais={(evento.gallery_urls ?? []) as string[]}
        />

      </main>
    </div>
  )
}
