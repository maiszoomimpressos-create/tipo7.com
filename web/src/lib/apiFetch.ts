'use client'

import { getAccessToken, initSession } from '@/lib/auth/session'

// Fetch pra rotas que exigem autenticação (guard valida Bearer token, lido
// do singleton de sessão do AuthModule próprio — ver web/src/lib/auth/session.ts).
// Continua usando caminho relativo /api/... — o next.config.mjs já faz o
// proxy transparente pro serviço novo, então isso não muda CSP nem precisa
// expor a URL do backend pro browser.
export async function apiFetchAuth(path: string, init: RequestInit = {}): Promise<Response> {
  await initSession() // no-op se já inicializado — garante token na primeira chamada da página
  const token = getAccessToken()

  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  return fetch(path, { ...init, headers, credentials: 'include' })
}
