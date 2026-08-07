import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PromoterLayout } from '@/components/layout/PromoterLayout'
import { GalleryHorizontal } from 'lucide-react'
import { CarrosselClient } from './CarrosselClient'

const ACCENT = '#E8B84B'

export default async function CarrosselPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/minha-area/marketing/carrossel')

  const res = await apiFetchServer('/api/carrossel')
  const { organizationId: orgId, slides } = res.ok
    ? await res.json() as { organizationId: string | null; slides: { id: string; image_url: string }[] }
    : { organizationId: null, slides: [] as { id: string; image_url: string }[] }

  if (!orgId) redirect('/criar-evento')

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
