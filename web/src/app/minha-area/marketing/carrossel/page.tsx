import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PromoterLayout } from '@/components/layout/PromoterLayout'
import { GalleryHorizontal } from 'lucide-react'
import { CarrosselClient } from './CarrosselClient'

const ACCENT = '#E8B84B'

export default async function CarrosselPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/minha-area/marketing/carrossel')

  const admin = createServiceClient()

  const { data: orgs } = await admin
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1)

  if (!orgs || orgs.length === 0) redirect('/criar-evento')

  const orgId = orgs[0].id

  const { data: slidesRaw } = await admin
    .from('carrossel_slides')
    .select('id, image_url, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })

  const slides = (slidesRaw ?? []).map(s => ({
    id:        s.id        as string,
    image_url: s.image_url as string,
  }))

  return (
    <>
      <Header />
      <PromoterLayout>
        <div className="p-6 md:p-8 max-w-4xl mx-auto flex flex-col gap-8">

          <div>
            <div className="flex items-center gap-3 mb-1">
              <GalleryHorizontal size={20} style={{ color: ACCENT }} />
              <h1 className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>
                Carrossel da segunda tela
              </h1>
            </div>
            <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              As imagens abaixo ficam passando na segunda tela da bilheteria enquanto não há venda em andamento.
            </p>
          </div>

          <CarrosselClient orgId={orgId} slidesIniciais={slides} />

        </div>
      </PromoterLayout>
      <Footer />
    </>
  )
}
