'use client'

// Hook de geolocalização — detecta a cidade do usuário via GPS do navegador
// Funciona para usuários logados e não logados
// Salva a cidade no localStorage para não pedir permissão toda visita
import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY        = 'tipo7_cidade'
const STORAGE_KEY_ESTADO = 'tipo7_estado'

export interface GeolocationState {
  city:            string | null // nome da cidade detectada ou escolhida
  state:           string | null // sigla do estado (UF) detectado, ex: "PR"
  loading:         boolean       // buscando localização
  denied:          boolean       // usuário negou a permissão
  askedPermission: boolean       // já perguntamos ao usuário
}

// Nome completo do estado (como o Nominatim devolve) → sigla (UF), que é
// o formato salvo em events.state. Chaves sem acento/minúsculas.
const UF_POR_ESTADO: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA',
  ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO',
  maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG',
  para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
  rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP',
  sergipe: 'SE', tocantins: 'TO',
}

function nomeEstadoParaUF(nome: string): string | null {
  const chave = nome
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .trim()
  return UF_POR_ESTADO[chave] ?? null
}

// Converte coordenadas (lat/lon) em cidade + estado usando OpenStreetMap (gratuito, sem chave)
async function reverseGeocode(lat: number, lon: number): Promise<{ city: string | null; state: string | null }> {
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
    const city = (
      data.address?.city        ||
      data.address?.town        ||
      data.address?.municipality||
      data.address?.state       ||
      null
    )
    const state = data.address?.state ? nomeEstadoParaUF(data.address.state) : null
    return { city, state }
  } catch {
    return { city: null, state: null }
  }
}

export function useGeolocation() {
  const [geo, setGeo] = useState<GeolocationState>({
    city:            null,
    state:           null,
    loading:         false,
    denied:          false,
    askedPermission: false,
  })

  // Ao montar, verifica se já temos cidade/estado salvos no localStorage
  useEffect(() => {
    const savedCity  = localStorage.getItem(STORAGE_KEY)
    const savedState = localStorage.getItem(STORAGE_KEY_ESTADO)
    if (savedCity || savedState) {
      setGeo(s => ({ ...s, city: savedCity, state: savedState, askedPermission: true }))
    }
  }, [])

  // Solicita permissão de localização ao navegador
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return
    if (geo.loading) return

    setGeo(s => ({ ...s, loading: true, askedPermission: true }))

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { city, state } = await reverseGeocode(
          position.coords.latitude,
          position.coords.longitude
        )
        if (city) {
          localStorage.setItem(STORAGE_KEY, city)
          if (state) localStorage.setItem(STORAGE_KEY_ESTADO, state)
          setGeo({ city, state, loading: false, denied: false, askedPermission: true })
        } else {
          setGeo(s => ({ ...s, loading: false }))
        }
      },
      () => {
        // Usuário negou ou erro de timeout
        setGeo({ city: null, state: null, loading: false, denied: true, askedPermission: true })
      },
      { timeout: 10000, enableHighAccuracy: false }
    )
  }, [geo.loading])

  // Permite que o usuário defina a cidade manualmente
  const setCity = useCallback((city: string) => {
    localStorage.setItem(STORAGE_KEY, city)
    setGeo(s => ({ ...s, city, loading: false, denied: false, askedPermission: true }))
  }, [])

  // Limpa a cidade/estado salvos (botão "mudar cidade")
  const clearCity = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY_ESTADO)
    setGeo({ city: null, state: null, loading: false, denied: false, askedPermission: false })
  }, [])

  return { ...geo, requestLocation, setCity, clearCity }
}
