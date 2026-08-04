'use client'

// Re-trava a área restrita se a aba ficar em segundo plano por 5 min ou
// mais. Em vez de contar com setTimeout rodando em background (navegador
// pode atrasar/pausar), guarda o instante em que ficou oculta e checa a
// diferença só quando a aba volta a ficar visível — é exatamente o momento
// que importa (alguém voltando pra tela).
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetchAuth } from '@/lib/apiFetch'

const LIMITE_MS = 5 * 60 * 1000

export function AreaRestritaWatcher({ currentPath }: { currentPath: string }) {
  const router    = useRouter()
  const hiddenAtRef = useRef<number | null>(null)

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        return
      }
      const hiddenAt = hiddenAtRef.current
      hiddenAtRef.current = null
      if (hiddenAt && Date.now() - hiddenAt >= LIMITE_MS) {
        apiFetchAuth('/api/admin/area-restrita/bloquear', { method: 'POST' }).finally(() => {
          router.push(`/admin/area-restrita?next=${encodeURIComponent(currentPath)}`)
        })
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [currentPath, router])

  return null
}
