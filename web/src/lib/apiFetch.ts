'use client'

import { getAccessToken, initSession } from '@/lib/auth/session'

// Fetch pra rotas que exigem autenticação (guard valida Bearer token, lido
// do singleton de sessão do AuthModule próprio — ver web/src/lib/auth/session.ts).
// Continua usando caminho relativo /api/... — o next.config.mjs já faz o
// proxy transparente pro serviço novo, então isso não muda CSP nem precisa
// expor a URL do backend pro browser.
//
// Achado real (07/09/2026, terminal token+PIN da GPOS780): NestJS devolve
// corpo TOTALMENTE VAZIO (200, sem nenhum byte) quando o handler retorna
// `null` — isso já tinha sido achado e corrigido do lado do servidor em
// 07/08/2026 (ver apiFetchServer.ts), mas a mesma proteção nunca foi
// replicada aqui, no fetch usado pelo NAVEGADOR/app nativo. Qualquer call
// site que fizer `res.ok ? await res.json() : ...` sem tratar corpo vazio
// (a esmagadora maioria) explode com "Unexpected end of JSON input" bem
// nos casos mais comuns — endpoint que legitimamente devolve `null` (ex:
// "sem caixa aberto ainda"). Mesmo padrão de mitigação: tenta de novo até
// 2x (cobre blip pontual de rede) e, se persistir vazio, devolve uma
// Response sintética com ok:false — todo call site que já checa `res.ok`
// cai automaticamente no fallback seguro dele sem precisar mudar nada.
export async function apiFetchAuth(path: string, init: RequestInit = {}): Promise<Response> {
  await initSession() // no-op se já inicializado — garante token na primeira chamada da página
  const token = getAccessToken()

  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const res = await fetch(path, { ...init, headers, credentials: 'include' })
    if (!res.ok) return res

    const text = await res.text()
    if (text) return new Response(text, { status: res.status, statusText: res.statusText, headers: res.headers })

    if (tentativa < 3) continue
    return new Response(null, { status: 502, statusText: 'Empty response from upstream' })
  }
  // Inalcançável (o loop acima sempre retorna), só pra satisfazer o TS.
  return new Response(null, { status: 502 })
}
