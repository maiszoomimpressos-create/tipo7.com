'use client'

import { useEffect } from 'react'

// Registra o Service Worker mínimo (public/sw.js) assim que o site carrega,
// em qualquer página — precisa estar registrado ANTES da pessoa clicar
// "Instalar", senão o navegador não reconhece o site como PWA instalável
// de verdade (ver achado do usuário, 25/08/2026, no commit deste arquivo).
// Silencioso de propósito: navegador sem suporte, ou falha de rede no
// registro, não deve gerar erro visível — instalar como PWA é um extra,
// nunca pode quebrar o site normal.
export function RegistrarServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return null
}
