'use client'

import { useEffect, useState } from 'react'

// Captura o evento `beforeinstallprompt` (Chrome/Edge/Android — instalação
// PWA de 1 clique) num módulo top-level, fora do ciclo de vida de qualquer
// componente React. Precisa ser assim porque o navegador dispara esse
// evento cedo, durante o carregamento da página — se só um componente
// específico escutasse (ex: BlocoTokenPin, que só monta depois da pessoa
// criar o PIN), o evento já teria passado e se perdido antes dele existir.
// Um `Set` de listeners consegue pegar carona no evento não importa quando
// o componente que precisa dele apareceu na árvore.
type PromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let capturedEvent: PromptEvent | null = null
let jaInstalado = false
const listeners = new Set<() => void>()

function notificar() {
  listeners.forEach(fn => fn())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    capturedEvent = e as PromptEvent
    notificar()
  })
  window.addEventListener('appinstalled', () => {
    jaInstalado = true
    capturedEvent = null
    notificar()
  })
  // Já rodando como PWA instalado (aberto pelo ícone, não pelo navegador) —
  // não faz sentido oferecer instalar de novo.
  if (window.matchMedia?.('(display-mode: standalone)').matches) {
    jaInstalado = true
  }
}

export function usePwaInstall() {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  return {
    // true só quando o navegador realmente suporta instalar com 1 clique
    // (Chrome/Edge/Android/desktop). iOS Safari nunca chega aqui — não
    // existe esse evento lá, tratado à parte (ver BlocoTokenPin).
    disponivel: !!capturedEvent && !jaInstalado,
    jaInstalado,
    async instalar(): Promise<'accepted' | 'dismissed' | null> {
      if (!capturedEvent) return null
      await capturedEvent.prompt()
      const { outcome } = await capturedEvent.userChoice
      capturedEvent = null
      notificar()
      return outcome
    },
  }
}

// iOS Safari não expõe `beforeinstallprompt` — único jeito é instrução
// manual (Compartilhar → Adicionar à Tela de Início). Detecta pra trocar o
// comportamento do botão em vez de mostrar algo que não faz nada.
export function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
  return isIOS && isSafari
}
