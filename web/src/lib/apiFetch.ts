'use client'

import { createClient } from '@/lib/supabase/client'

// Fetch pra rotas migradas pro NestJS que exigem autenticação (guard valida
// Bearer token, não o cookie de sessão do Supabase que o Next.js usava
// antes). Continua usando caminho relativo /api/... — o next.config.mjs já
// faz o proxy transparente pro serviço novo, então isso não muda CSP nem
// precisa expor a URL do backend pro browser.
export async function apiFetchAuth(path: string, init: RequestInit = {}): Promise<Response> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const headers = new Headers(init.headers)
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)

  return fetch(path, { ...init, headers })
}
