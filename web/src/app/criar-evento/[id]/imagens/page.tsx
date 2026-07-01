import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { ImagensClient } from './ImagensClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ImagensPage({ params }: Props) {
  const { id }   = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/criar-evento')

  const { data: evento } = await supabase
    .from('events')
    .select('id, title, banner_url, gallery_urls, organizations(owner_id)')
    .eq('id', id)
    .single()

  if (!evento) notFound()

  const org = Array.isArray(evento.organizations)
    ? evento.organizations[0]
    : evento.organizations as { owner_id: string } | null
  if (!org || (org as { owner_id: string }).owner_id !== user.id) notFound()

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-12">

        {/* Indicador de etapas */}
        <div className="flex items-center gap-2 mb-8">
          <a href={`/criar-evento/${id}`}
            className="flex items-center gap-1.5 text-[#555] hover:text-white text-xs transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <span className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-500 text-[10px]">✓</span>
            Informações
          </a>
          <div className="h-px flex-1 bg-[#1a1a1a]" />
          <a href={`/criar-evento/${id}/ingressos`}
            className="flex items-center gap-1.5 text-[#555] hover:text-white text-xs transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <span className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-500 text-[10px]">✓</span>
            Ingressos
          </a>
          <div className="h-px flex-1 bg-[#1a1a1a]" />
          <div className="flex items-center gap-1.5 text-white text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <span className="w-5 h-5 rounded-full bg-[#E8B84B] flex items-center justify-center text-[#070707] text-[10px] font-bold">3</span>
            Imagens
          </div>
          <div className="h-px flex-1 bg-[#1a1a1a]" />
          <div className="flex items-center gap-1.5 text-[#333] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <span className="w-5 h-5 rounded-full bg-[#111] border border-[#222] flex items-center justify-center text-[10px]">4</span>
            Publicar
          </div>
        </div>

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
          bannerUrlInicial={evento.banner_url ?? null}
          galleryUrlsIniciais={(evento.gallery_urls ?? []) as string[]}
        />

      </main>
    </div>
  )
}
