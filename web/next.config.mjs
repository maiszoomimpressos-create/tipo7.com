/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === 'development'

const securityHeaders = [
  { key: 'X-Frame-Options',            value: 'DENY' },
  { key: 'X-Content-Type-Options',     value: 'nosniff' },
  { key: 'Strict-Transport-Security',  value: 'max-age=31536000; includeSubDomains' },
  { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',         value: 'camera=(self), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Em dev, React precisa de 'unsafe-eval' para reconstruir callstacks
      // accounts.google.com/gsi/client — SDK do Google Identity Services
      // (botão "Entrar com Google" + One Tap, ver handleGoogleLogin em
      // app/auth/page.tsx) — sem isso no script-src o próprio carregamento
      // do script é bloqueado pelo CSP (achado real, 12/08/2026).
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.mercadopago.com https://accounts.google.com"
        : "script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com https://accounts.google.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://picsum.photos https://fastly.picsum.photos",
      "font-src 'self'",
      // http://localhost:8080 — PrintServer local (RawBts ou TipPrint
      // provisionado, mesma API — ver lib/printServerClient.ts,
      // components/PrintServerPanel.tsx). Faltava aqui desde sempre: achado
      // real (14/08/2026) via print do usuário mostrando "Failed to fetch"
      // no console — "Refused to connect because it violates the CSP" —
      // toda venda com formato 'printserver' falhava silenciosamente ao
      // tentar imprimir, em qualquer navegador, mesmo com o PrintServer
      // rodando certinho no PC.
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mercadopago.com https://nominatim.openstreetmap.org https://maps.googleapis.com https://viacep.com.br https://accounts.google.com http://localhost:8080 wss://localhost:8181 ws://localhost:8182",
      // accounts.google.com — o One Tap/GSI renderiza o prompt de login num
      // iframe dessa origem, mesmo motivo do script-src acima.
      "frame-src https://www.mercadopago.com.br https://www.mercadopago.com https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

// Rotas já migradas pro serviço NestJS (server/) — ver plano de migração em
// memória do projeto. Proxy transparente: o browser continua chamando
// /api/... (mesma origem, sem precisar mexer em CSP connect-src), o Next.js
// que redireciona pro backend novo. API_URL aponta pro NestJS local em dev
// (padrão localhost:3001) e pro domínio real em produção (env var na EasyPanel).
const API_URL = process.env.API_URL ?? 'http://localhost:3001'
const ROTAS_MIGRADAS_NESTJS = [
  '/api/eventos/buscar',
  '/api/eventos/destaque',
  '/api/eventos',
  '/api/eventos/locais-recentes',
  '/api/eventos/meus',
  '/api/eventos/:id',
  '/api/eventos/:id/meu-acesso',
  '/api/eventos/:id/meu-caixa',
  '/api/eventos/:id/ingressos-resumo',
  '/api/eventos/:id/gateway-status',
  '/api/eventos/:id/dashboard',
  '/api/profile',
  '/api/profile/promotor',
  '/api/profile/veiculo',
  '/api/profile/veiculo/:placa',
  '/api/orders/minhas',
  '/api/orders/tickets/:ticketId/reenviar-whatsapp',
  '/api/orders/:orderId/holder-resumo',
  '/api/orders/:orderId/holder-preencher-meus-dados',
  '/api/orders/:orderId/holder-link',
  '/api/public/holder-links/cpf-lookup-local',
  '/api/public/holder-links/cpf-confirmar-local',
  '/api/public/holder-links/:token',
  '/api/public/holder-links/:token/reivindicar',
  '/api/stats',
  '/api/check-cpf',
  '/api/check-cnpj',
  '/api/check-phone',
  '/api/staff-function-templates',
  '/api/places/autocomplete',
  '/api/places/details',
  '/api/codigo',
  '/api/organizations',
  '/api/organizations/:path*',
  '/api/eventos/:id/equipe',
  '/api/eventos/:id/funcoes',
  '/api/eventos/:id/funcoes/:funcaoId',
  '/api/eventos/:id/modulos',
  '/api/eventos/:id/publicar',
  '/api/venues',
  '/api/venues/minhas',
  '/api/venues/:id/tornar-responsavel',
  '/api/admin/conteudo',
  '/api/admin/equipe',
  '/api/admin/estabelecimentos',
  '/api/admin/promotores',
  '/api/admin/promotores/:userId',
  '/api/admin/eventos',
  '/api/admin/funcoes',
  '/api/admin/funcoes/:id',
  '/api/admin/roadmap',
  '/api/admin/settings',
  '/api/admin/mp-rates',
  '/api/admin/whoami',
  '/api/admin/stats',
  '/api/admin/fee-rules',
  '/api/admin/fee-rules/opcoes',
  '/api/admin/saldo-bilheteria',
  '/api/admin/saldo-bilheteria/movimentos',
  '/api/admin/integracoes',
  '/api/admin/integracoes/:id',
  '/api/admin/integracoes/rotas/:id',
  '/api/admin/banners-sistema',
  '/api/admin/banners-sistema/:id',
  '/api/admin/gateway-logo',
  '/api/admin/ingressos/buscar',
  '/api/admin/area-restrita/senha',
  '/api/admin/area-restrita/desbloquear',
  '/api/admin/area-restrita/bloquear',
  '/api/admin/area-restrita/recuperar',
  '/api/admin/area-restrita/status',
  '/api/platform-settings/public',
  '/api/eventos/:id/caixas',
  '/api/eventos/:id/estacionamentos',
  '/api/eventos/:id/estacionamentos/:path*',
  '/api/caixas/:path*',
  '/api/estacionamento/:path*',
  '/api/scanner/validate',
  '/api/bilheteria/:path*',
  '/api/checkout',
  '/api/checkout/pix',
  '/api/checkout/pix/status/:orderId',
  '/api/checkout/card',
  '/api/checkout/gateway',
  '/api/checkout/mp-config',
  '/api/checkout/pagbank-pix',
  '/api/checkout/pagbank-pix/status/:orderId',
  '/api/checkout/pagbank-card',
  '/api/checkout/pagbank-config',
  '/api/webhooks/mercadopago',
  '/api/webhooks/pagbank',
  '/api/mp/:path*',
  '/api/pagbank/:path*',
  '/api/admin/payment-credentials',
  '/api/qz/:path*',
  '/api/qr/:token',
  '/api/auth/cpf-lookup',
  '/api/auth/cpf-confirmar',
  '/api/auth/sync-autosave',
  '/api/webhooks/autosave',
  '/api/trabalhos',
  '/api/trabalhos/responder',
  // Faltava — POST /trabalhos/pin (BlocoTokenPin.tsx) dava 404 desde que a
  // feature de token+PIN foi criada (19/08/2026), achado real 21/08/2026 ao
  // construir a rota pública /caixa que depende do mesmo PIN.
  '/api/trabalhos/pin',
  '/api/usuarios/buscar',
  '/api/holders',
  '/api/ingressos/:id',
  '/api/ingressos/:id/lotes',
  '/api/ingressos/lotes/:loteId',
  '/api/eventos/:id/criar-filho',
  '/api/carrossel',
  '/api/carrossel/segunda-tela/:eventoId',
  '/api/carrossel/upload',
  '/api/carrossel/:slideId',
  '/api/minha-area/dashboard',
  '/api/minha-area/eventos-publicados',
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/auth/verify-password',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/google',
  '/api/auth/google/callback',
  '/api/auth/google/onetap',
  '/api/auth/entrar-com-pin',
  '/api/uploads/avatar',
  '/api/uploads/event-image/:eventoId',
  '/api/uploads/organization-logo/:orgId',
  '/api/eventos/:id/dias',
  '/api/eventos/:id/vendidos-por-ingresso',
  '/api/eventos/:id/atributos',
  '/api/eventos/:id/atributos/:attributeId',
  '/api/admin/atributos',
  '/api/admin/atributos/:id',
  '/api/usuarios/admin-lista',
  '/api/tipprint/provision',
]

// Uploads (avatar/banner/logo/carrossel) servidos direto do disco do
// server/ (ver server/src/storage/) — não fica sob /api porque não é uma
// rota de API, é conteúdo estático. Mesmo esquema de rewrite, mesma origem
// do site (sem precisar liberar outro domínio no CSP img-src).
const ROTAS_ESTATICAS_NESTJS = ['/uploads/:path*']

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: import.meta.dirname,
  },
  async rewrites() {
    return [...ROTAS_MIGRADAS_NESTJS, ...ROTAS_ESTATICAS_NESTJS].map((source) => ({
      source,
      destination: `${API_URL}${source.replace(/^\/api/, '')}`,
    }))
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // Segunda Tela precisa poder ser embutida num iframe same-origin —
      // painel de monitoramento no caixa do PC (pedido do usuário,
      // 11/08/2026), pra acompanhar ao vivo o que está na tela do
      // celular/tablet sem precisar olhar o aparelho físico. SAMEORIGIN
      // ainda bloqueia embed de fora do próprio domínio; a regra genérica
      // acima continua DENY pra todo o resto do site. Config mais
      // específica listada depois — Next.js aplica por ordem, a última
      // que casa a rota vence pra chaves repetidas.
      {
        source: '/segunda-tela/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

export default nextConfig
