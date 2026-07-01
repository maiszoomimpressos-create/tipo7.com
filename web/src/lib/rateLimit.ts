// Rate limiter centralizado via Supabase.
// Funciona em ambientes serverless multi-instância (Vercel) porque persiste
// os contadores no banco, não em memória.
// Os endpoints menos críticos podem usar rateLimitLocal (em memória) para zero latência.

import { createServiceClient } from '@/lib/supabase/server'

// Rate limit centralizado via banco — funciona entre todas as instâncias Vercel.
// Usa a função SQL check_rate_limit (migration 20260630000002).
export async function rateLimit(
  ip:       string,
  key:      string,
  max:      number,
  windowMs: number,
): Promise<boolean> {
  const windowSeconds = Math.ceil(windowMs / 1000)
  try {
    const admin = createServiceClient()
    const { data } = await admin.rpc('check_rate_limit', {
      p_ip:             ip,
      p_key:            key,
      p_max:            max,
      p_window_seconds: windowSeconds,
    })
    return data === true
  } catch {
    // Em caso de falha do banco, permite a requisição (fail open)
    // para não derrubar o serviço por problema de rate limit
    return true
  }
}

// Rate limit em memória — zero latência, mas não funciona entre instâncias.
// Use apenas para endpoints de baixo risco onde a eventual perda de limite é aceitável.
const windows = new Map<string, number[]>()
export function rateLimitLocal(
  ip:       string,
  key:      string,
  max:      number,
  windowMs: number,
): boolean {
  const k     = `${key}:${ip}`
  const now   = Date.now()
  const prev  = windows.get(k) ?? []
  const valid = prev.filter(t => now - t < windowMs)
  valid.push(now)
  windows.set(k, valid)
  return valid.length <= max
}

// Extrai o IP real da requisição (funciona atrás de proxy/Vercel).
export function getIp(req: import('next/server').NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '0.0.0.0'
  )
}

export function tooManyRequests() {
  return new Response(
    JSON.stringify({ error: 'Muitas tentativas. Aguarde um momento.' }),
    { status: 429, headers: { 'Content-Type': 'application/json' } },
  )
}
