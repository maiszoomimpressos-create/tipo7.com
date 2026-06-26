import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SearchSection } from '@/components/home/SearchSection'
import { LocationProvider } from '@/contexts/LocationContext'

export const metadata = {
  title:       'Explorar eventos — tipo7',
  description: 'Encontre shows, festas, festivais e muito mais perto de você.',
}

export default function EventosPage() {
  return (
    <LocationProvider>
      <div className="min-h-dvh bg-[#070707] flex flex-col">
        <Header />

        <main className="flex-1">
          {/* Hero */}
          <div className="max-w-6xl mx-auto px-4 pt-12 pb-2">
            <h1
              className="text-3xl text-white font-semibold"
              style={{ fontFamily: 'var(--font-outfit)' }}>
              Explorar eventos
            </h1>
            <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Shows, festas, festivais e muito mais — encontre o que acontece perto de você.
            </p>
          </div>

          {/* Busca + grid */}
          <SearchSection limit={48} />
        </main>

        <Footer />
      </div>
    </LocationProvider>
  )
}
