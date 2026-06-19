import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // Domínios autorizados para carregar imagens externas
    remotePatterns: [
      {
        // Placeholder de imagens para desenvolvimento
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        // Supabase Storage — imagens reais dos eventos futuramente
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
}

export default nextConfig
