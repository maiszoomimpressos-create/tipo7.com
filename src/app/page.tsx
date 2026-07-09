// Página inicial — landing page do Tipo7
import { Header }        from '@/components/layout/Header'
import { Carousel }      from '@/components/home/Carousel'
import { StatsBar }      from '@/components/home/StatsBar'
import { SearchSection } from '@/components/home/SearchSection'
import { PromoterCTA }   from '@/components/home/PromoterCTA'
import { Footer }        from '@/components/layout/Footer'

export default function Home() {
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--pp-bg)' }}>
      <Header />
      <main className="flex-1">

        {/* ── Banda escura: carrossel herói ─────────────────────────────── */}
        <div style={{
          background: `
            radial-gradient(ellipse 85% 65% at 50% 110%, rgba(251,86,7,0.28) 0%, transparent 62%),
            radial-gradient(ellipse 55% 45% at 12% 18%, rgba(131,56,236,0.14) 0%, transparent 55%),
            radial-gradient(ellipse 40% 30% at 88% 12%, rgba(251,86,7,0.09) 0%, transparent 52%),
            #3d1208
          `,
        }}>
          <Carousel />
        </div>

        {/* ── Seções claras ─────────────────────────────────────────────── */}
        <StatsBar />
        <SearchSection />
        <PromoterCTA />

      </main>
      <Footer />
    </div>
  )
}
