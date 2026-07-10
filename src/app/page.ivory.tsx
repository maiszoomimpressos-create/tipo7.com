// Página inicial — landing page do Tipo7
import { Header }        from '@/components/layout/Header'
import { Carousel }      from '@/components/home/Carousel'
import { StatsBar }      from '@/components/home/StatsBar'
import { SearchSection } from '@/components/home/SearchSection'
import { PromoterCTA }   from '@/components/home/PromoterCTA'
import { Footer }        from '@/components/layout/Footer'

export default function Home() {
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg)' }}>
      <Header />
      <main className="flex-1">
        <Carousel />
        <StatsBar />
        <SearchSection />
        <PromoterCTA />
      </main>
      <Footer />
    </div>
  )
}
