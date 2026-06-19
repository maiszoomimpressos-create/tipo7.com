// Página inicial — landing page do Tipo7
import { Header }       from '@/components/layout/Header'
import { Carousel }     from '@/components/home/Carousel'
import { LocationBar }  from '@/components/home/LocationBar'
import { EventGrid }    from '@/components/home/EventGrid'
import { PromoterCTA }  from '@/components/home/PromoterCTA'
import { Footer }       from '@/components/layout/Footer'
import { LocationProvider } from '@/contexts/LocationContext'

export default function Home() {
  return (
    <LocationProvider>
      <div className="min-h-dvh bg-[#070707] flex flex-col">
        <Header />
        <main className="flex-1">
          <LocationBar />
          <Carousel />
          <EventGrid />
          <PromoterCTA />
        </main>
        <Footer />
      </div>
    </LocationProvider>
  )
}
