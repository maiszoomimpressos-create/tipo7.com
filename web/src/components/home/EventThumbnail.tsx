'use client'

import { useState, type ReactNode } from 'react'

// EventGrid é Server Component (busca dados via apiFetchServer) — `onError`
// só existe no client, daí esse pedaço isolado. Mesmo motivo do
// ImageWithFallback (ver web/src/components/ui/): banner_url não-nulo mas
// apontando pro Supabase morto (achado real, 14/08/2026) quebrava em
// runtime, sem jeito de pegar isso em build/SSR.
export function EventThumbnail({ src, alt, fallback }: { src: string; alt: string; fallback: ReactNode }) {
  const [broken, setBroken] = useState(false)

  if (broken) return <>{fallback}</>

  return <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => setBroken(true)} />
}
