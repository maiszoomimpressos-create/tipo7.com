'use client'

// Barra de localização — exibida abaixo do header na landing page
// Mostra a cidade detectada e permite mudar ou detectar novamente
import { MapPin, Navigation, X, Loader2 } from 'lucide-react'
import { useLocation } from '@/contexts/LocationContext'

export function LocationBar() {
  const { city, loading, denied, askedPermission, requestLocation, clearCity } = useLocation()

  // ── Ainda não perguntamos — exibe convite para detectar localização ──
  if (!askedPermission) {
    return (
      <div className="w-full bg-[#111111] border-b border-[#222222]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-2.5 flex items-center justify-between gap-4">
          <span
            className="text-[#888888] text-sm"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Descubra eventos perto de você
          </span>
          <button
            onClick={requestLocation}
            className="flex items-center gap-1.5 text-[#E8B84B] text-sm font-medium hover:text-[#F0C96A] transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            <Navigation size={13} strokeWidth={2.5} />
            Detectar minha localização
          </button>
        </div>
      </div>
    )
  }

  // ── Buscando localização ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full bg-[#111111] border-b border-[#222222]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-2.5 flex items-center gap-2">
          <Loader2 size={13} className="text-[#E8B84B] animate-spin" />
          <span className="text-[#888888] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Detectando sua localização...
          </span>
        </div>
      </div>
    )
  }

  // ── Permissão negada ─────────────────────────────────────────────
  if (denied) {
    return (
      <div className="w-full bg-[#111111] border-b border-[#222222]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-[#888888]" />
            <span className="text-[#888888] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Exibindo eventos de todo o Brasil
            </span>
          </div>
          <button
            onClick={requestLocation}
            className="text-[#E8B84B] text-sm hover:text-[#F0C96A] transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  // ── Cidade detectada ─────────────────────────────────────────────
  if (city) {
    return (
      <div className="w-full bg-[#111111] border-b border-[#222222]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-[#E8B84B]" />
            <span className="text-[#E8B84B] text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {city}
            </span>
            <span className="text-[#555555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              — eventos perto de você
            </span>
          </div>
          <button
            onClick={clearCity}
            className="flex items-center gap-1 text-[#555555] text-xs hover:text-[#888888] transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
            aria-label="Mudar cidade"
          >
            <X size={12} />
            Mudar cidade
          </button>
        </div>
      </div>
    )
  }

  return null
}
