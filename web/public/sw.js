// Service Worker mínimo pro PWA da rota /caixa (Fase B, ver
// docs/plano-terminais-caixa-pwa.md). Achado do usuário (25/08/2026):
// sem nenhum service worker registrado, o Chrome/Windows não tratava o
// site como "app instalado de verdade" — criava um atalho pra página
// ATUAL em vez de honrar `start_url` do manifest (app.manifest.ts), então
// reabrir o ícone voltava pra onde a pessoa estava (com a própria sessão
// logada), nunca pra /caixa. Isso aqui é só o suficiente pra passar no
// critério de instalabilidade — não faz cache de nada, não guarda nada
// offline, todo fetch vai direto pra rede, sempre. Se algum dia quisermos
// cache/offline de verdade, é outra conversa, com cuidado pra não servir
// conteúdo velho (preço de ingresso, saldo de caixa) por engano.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
