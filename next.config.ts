import type { NextConfig } from 'next'

const securityHeaders = [
  // Impede que a página seja embutida em iframe (proteção contra clickjacking)
  { key: 'X-Frame-Options',        value: 'DENY' },
  // Impede que o browser tente adivinhar o tipo do arquivo (MIME sniffing)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Força HTTPS por 1 ano e inclui subdomínios
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Não envia a URL completa de origem em requisições cross-site
  { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
  // Restringe APIs de browser: câmera permitida apenas no próprio domínio (scanner de ingressos)
  { key: 'Permissions-Policy',     value: 'camera=(self), microphone=(), geolocation=()' },
  // CSP: permite recursos apenas de origens confiáveis
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.mercadopago.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://picsum.photos https://fastly.picsum.photos",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mercadopago.com https://nominatim.openstreetmap.org https://maps.googleapis.com https://viacep.com.br",
      "frame-src https://www.mercadopago.com.br https://www.mercadopago.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
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
