'use client'

// Contexto de localização — compartilha a cidade do usuário com todos os componentes
// Qualquer componente pode saber a cidade e pedir para mudar sem prop drilling
import { createContext, useContext, type ReactNode } from 'react'
import { useGeolocation, type GeolocationState } from '@/hooks/useGeolocation'

interface LocationContextValue extends GeolocationState {
  requestLocation: () => void
  setCity:         (city: string) => void
  clearCity:       () => void
}

const LocationContext = createContext<LocationContextValue | null>(null)

// Provider — envolve a aplicação no layout ou na página
export function LocationProvider({ children }: { children: ReactNode }) {
  const geo = useGeolocation()
  return (
    <LocationContext.Provider value={geo}>
      {children}
    </LocationContext.Provider>
  )
}

// Hook para consumir o contexto em qualquer componente
export function useLocation() {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocation deve ser usado dentro de <LocationProvider>')
  return ctx
}
