'use client'

// Hook de geolocalização — detecta a cidade do usuário via GPS do navegador
// Funciona para usuários logados e não logados
// Salva a cidade no localStorage para não pedir permissão toda visita
import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'tipo7_cidade'

export interface GeolocationState {
  city:            string | null // nome da cidade detectada ou escolhida
  loading:         boolean       // buscando localização
  denied:          boolean       // usuário negou a permissão
  askedPermission: boolean       // já perguntamos ao usuário
}

// Converte coordenadas (lat/lon) em nome de cidade usando OpenStreetMap (gratuito, sem chave)
async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      {
        headers: {
          'Accept-Language': 'pt-BR',
          'User-Agent': 'Tipo7/1.0',
        },
      }
    )
    const data = await res.json()
    // Tenta pegar cidade, município ou estado em ordem de preferência
    return (
      data.address?.city        ||
      data.address?.town        ||
      data.address?.municipality||
      data.address?.state       ||
      null
    )
  } catch {
    return null
  }
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    city:            null,
    loading:         false,
    denied:          false,
    askedPermission: false,
  })

  // Ao montar, verifica se já temos cidade salva no localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setState(s => ({ ...s, city: saved, askedPermission: true }))
    }
  }, [])

  // Solicita permissão de localização ao navegador
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return
    if (state.loading) return

    setState(s => ({ ...s, loading: true, askedPermission: true }))

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const city = await reverseGeocode(
          position.coords.latitude,
          position.coords.longitude
        )
        if (city) {
          localStorage.setItem(STORAGE_KEY, city)
          setState({ city, loading: false, denied: false, askedPermission: true })
        } else {
          setState(s => ({ ...s, loading: false }))
        }
      },
      () => {
        // Usuário negou ou erro de timeout
        setState({ city: null, loading: false, denied: true, askedPermission: true })
      },
      { timeout: 10000, enableHighAccuracy: false }
    )
  }, [state.loading])

  // Permite que o usuário defina a cidade manualmente
  const setCity = useCallback((city: string) => {
    localStorage.setItem(STORAGE_KEY, city)
    setState({ city, loading: false, denied: false, askedPermission: true })
  }, [])

  // Limpa a cidade salva (botão "mudar cidade")
  const clearCity = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setState({ city: null, loading: false, denied: false, askedPermission: false })
  }, [])

  return { ...state, requestLocation, setCity, clearCity }
}
