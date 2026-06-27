// Rate limiter em memória com janela deslizante.
// Em ambientes serverless (Vercel), cada instância tem sua própria memória —
// o limite é por instância, não global. Ainda assim reduz significativamente
// força bruta e enumeração.

const windows = new Map<string, number[]>()

// Retorna true se a requisição for permitida, false se exceder o limite.
export function rateLimit(
  ip: string,
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const k   = `${key}:${ip}`
  const now = Date.now()
  const prev = windows.get(k) ?? []
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
