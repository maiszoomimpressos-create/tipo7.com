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
  '/api/venues/:id/tornar-responsavel',
  '/api/admin/conteudo',
  '/api/admin/equipe',
  '/api/admin/promotores/:userId',
  '/api/admin/roadmap',
  '/api/admin/settings',
  '/api/admin/mp-rates',
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
  '/api/eventos/:id/caixas',
  '/api/eventos/:id/estacionamentos',
  '/api/eventos/:id/estacionamentos/:path*',
  '/api/caixas/:path*',
  '/api/estacionamento/:path*',
  '/api/scanner/validate',
  '/api/bilheteria/:path*',
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
