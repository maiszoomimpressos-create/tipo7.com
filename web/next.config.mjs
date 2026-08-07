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
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.mercadopago.com"
        : "script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://picsum.photos https://fastly.picsum.photos",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mercadopago.com https://nominatim.openstreetmap.org https://maps.googleapis.com https://viacep.com.br wss://localhost:8181 ws://localhost:8182",
      "frame-src https://www.mercadopago.com.br https://www.mercadopago.com",
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
  '/api/eventos/:id',
  '/api/eventos/:id/meu-acesso',
  '/api/eventos/:id/meu-caixa',
  '/api/eventos/:id/ingressos-resumo',
  '/api/eventos/:id/dashboard',
  '/api/profile',
  '/api/orders/minhas',
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
  '/api/admin/fee-rules',
  '/api/admin/saldo-bilheteria',
  '/api/admin/saldo-bilheteria/movimentos',
  '/api/admin/integracoes',
  '/api/admin/integracoes/:id',
  '/api/admin/integracoes/rotas/:id',
  '/api/admin/banners-sistema',
  '/api/admin/banners-sistema/:id',
  '/api/admin/gateway-logo',
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
  '/api/usuarios/buscar',
  '/api/holders',
  '/api/ingressos/:id',
  '/api/eventos/:id/criar-filho',
  '/api/carrossel',
  '/api/carrossel/upload',
  '/api/carrossel/:slideId',
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
  '/api/uploads/avatar',
  '/api/uploads/event-image/:eventoId',
  '/api/uploads/organization-logo/:orgId',
  '/api/eventos/:id/dias',
  '/api/eventos/:id/atributos',
  '/api/eventos/:id/atributos/:attributeId',
  '/api/admin/atributos',
  '/api/admin/atributos/:id',
  '/api/usuarios/admin-lista',
]

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: import.meta.dirname,
  },
  async rewrites() {
    return ROTAS_MIGRADAS_NESTJS.map((source) => ({
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
