import 'server-only'
import { cookies, headers as nextHeaders } from 'next/headers'

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

// Lê o corpo como JSON com tolerância a resposta vazia/malformada — achado
// real (07/08/2026): uma resposta 2xx com corpo vazio (blip de rede entre
// `web` e `server`, ainda sob investigação) faz `res.json()` estourar
// "Unexpected end of JSON input" e derruba a página inteira (Server
// Component sem try/catch = 500 pro visitante). Usar isso em vez de
// `res.ok ? await res.json() : null` em qualquer Server Component novo —
// trata corpo vazio/malformado como "sem dado" em vez de crashar a página.
export async function safeJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null
  try {
    const text = await res.text()
    return text ? (JSON.parse(text) as T) : null
  } catch {
    return null
  }
}

export async function apiFetchServer(path: string, init: RequestInit = {}): Promise<Response> {
  const jar = await cookies()
  const token = jar.get('access_token')?.value

  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const reqHeaders = await nextHeaders()

  // Repassa o cookie inteiro também, não só o access_token como Bearer —
  // achado real (07/08/2026): rotas que leem cookie próprio no NestJS (ex:
  // area_restrita_unlock em GET /admin/area-restrita/status) nunca recebiam
  // esse cookie por aqui, porque só extraíamos o access_token. Resultado:
  // qualquer checagem de "já desbloqueou a área restrita?" feita a partir
  // de um Server Component sempre dava falso, mesmo logo depois de
  // desbloquear com a senha certa — looping de volta pro cadeado pra
  // sempre. Repassar o Cookie inteiro é seguro aqui (chamada interna
  // servidor-a-servidor, nunca exposta ao browser) e não muda nada pra
  // quem só lê access_token via Authorization: Bearer (que continua tendo
  // prioridade na SupabaseJwtStrategy).
  const rawCookie = reqHeaders.get('cookie')
  if (rawCookie) headers.set('cookie', rawCookie)

  // Propaga o IP real do visitante pro NestJS — sem isso, todo SSR chamado
  // daqui (ex: home pública) chegaria no rate-limiter do backend com o IP
  // interno do container `web`, não o do visitante, e todos os visitantes
  // acabariam dividindo o mesmo balde de rate-limit (achado real revisando
  // o porte de EventGrid.tsx pra GET /eventos/buscar, que tem limite de
  // 20 req/min por IP — sem isso a home cairia sozinha sob tráfego real).
  const forwardedFor = reqHeaders.get('x-forwarded-for') ?? reqHeaders.get('x-real-ip')
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor)

  // Aceita tanto '/api/eventos/123' (caminho público que o browser vê)
  // quanto '/eventos/123' (já sem o prefixo) — sempre bate direto no
  // NestJS, nunca passa pelo rewrite do Next.
  const cleanPath = path.replace(/^\/api/, '')
  return fetch(`${API_URL}${cleanPath}`, { ...init, headers, cache: 'no-store' })
}
