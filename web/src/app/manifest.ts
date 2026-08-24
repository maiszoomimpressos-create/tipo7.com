import type { MetadataRoute } from 'next'

// PWA da rota /caixa (Fase B do plano em docs/plano-terminais-caixa-pwa.md,
// 24/08/2026) — não é o site inteiro virando "app", é especificamente o
// portal de acesso da equipe (token+PIN → caixa/scanner/estacionamento) que
// fica instalável na tela inicial de PC/tablet/celular/maquininha, sem
// precisar decorar a URL nem passar pelo navegador toda vez. `start_url`
// aponta direto pra lá.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tipo7 — Caixa',
    short_name: 'Tipo7 Caixa',
    description: 'Acesso rápido ao caixa, scanner ou estacionamento do seu evento na Tipo7.',
    start_url: '/caixa',
    scope: '/',
    display: 'standalone',
    background_color: '#070707',
    theme_color: '#070707',
    lang: 'pt-BR',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
