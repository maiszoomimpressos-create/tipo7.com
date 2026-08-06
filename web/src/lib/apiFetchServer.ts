import 'server-only'
import { cookies } from 'next/headers'

// Fetch autenticado pro NestJS a partir de Server Components/Server Actions
// (apiFetchAuth, em lib/apiFetch.ts, é 'use client' e não serve aqui — é
// por isso que os Server Components ainda leem Supabase direto hoje).
// Bate direto em API_URL (mesma URL interna que next.config.mjs usa nos
// rewrites — nome do serviço no Docker Swarm, não o domínio público),
// passando o access_token do cookie httpOnly como Bearer. Nunca expor
// API_URL pro browser (sem prefixo NEXT_PUBLIC_).
//
// Padrão a reusar em qualquer Server Component/Server Action que precise
// chamar uma rota autenticada do NestJS (resto da Fase 7.2).
const API_URL = process.env.API_URL ?? 'http://localhost:3001'

export async function apiFetchServer(path: string, init: RequestInit = {}): Promise<Response> {
  const jar = await cookies()
  const token = jar.get('access_token')?.value

  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  // Aceita tanto '/api/eventos/123' (caminho público que o browser vê)
  // quanto '/eventos/123' (já sem o prefixo) — sempre bate direto no
  // NestJS, nunca passa pelo rewrite do Next.
  const cleanPath = path.replace(/^\/api/, '')
  return fetch(`${API_URL}${cleanPath}`, { ...init, headers, cache: 'no-store' })
}
