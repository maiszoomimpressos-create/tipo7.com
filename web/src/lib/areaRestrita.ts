// Step-up auth da área restrita (Equipe, Financeiro, API) — cada pessoa com
// acesso_restrito=true também cadastra uma senha própria (separada da senha
// de login) e precisa digitá-la pra desbloquear essas telas. Desbloqueio
// dura 30 min por sessão de navegador, guardado num cookie assinado.
import { cookies } from 'next/headers'
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto'

const COOKIE_NAME     = 'area_restrita_unlock'
const DURACAO_MS      = 30 * 60 * 1000 // 30 minutos
const SEGREDO         = process.env.QR_SECRET!

// ── Hash da senha própria (pbkdf2/scrypt, sem dependência nova) ──────────

export function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(senha, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verificarSenha(senha: string, hashArmazenado: string): boolean {
  const [salt, hash] = hashArmazenado.split(':')
  if (!salt || !hash) return false
  const hashTentativa = scryptSync(senha, salt, 64)
  const hashOriginal  = Buffer.from(hash, 'hex')
  if (hashTentativa.length !== hashOriginal.length) return false
  return timingSafeEqual(hashTentativa, hashOriginal)
}

// ── Token de desbloqueio assinado (HMAC) — cookie httpOnly guarda isto ───

function assinar(payload: string): string {
  return createHmac('sha256', SEGREDO).update(payload).digest('hex')
}

function criarToken(userId: string): string {
  const expiresAt = Date.now() + DURACAO_MS
  const payload    = `${userId}:${expiresAt}`
  return `${payload}:${assinar(payload)}`
}

function tokenValido(token: string, userId: string): boolean {
  const partes = token.split(':')
  if (partes.length !== 3) return false
  const [tokenUserId, expiresAtStr, assinatura] = partes
  if (tokenUserId !== userId) return false

  const payload = `${tokenUserId}:${expiresAtStr}`
  const esperada = assinar(payload)
  if (esperada.length !== assinatura.length) return false
  if (!timingSafeEqual(Buffer.from(esperada), Buffer.from(assinatura))) return false

  const expiresAt = Number(expiresAtStr)
  return Number.isFinite(expiresAt) && Date.now() < expiresAt
}

// ── Helpers de cookie (server-side, Next.js) ──────────────────────────────

export async function desbloquearAreaRestrita(userId: string) {
  const jar = await cookies()
  jar.set(COOKIE_NAME, criarToken(userId), {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    maxAge:   DURACAO_MS / 1000,
    path:     '/',
  })
}

export async function areaRestritaDesbloqueada(userId: string): Promise<boolean> {
  const jar   = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (!token) return false
  return tokenValido(token, userId)
}

// Re-trava na hora — usado quando a aba fica em segundo plano por tempo
// demais (ver AreaRestritaWatcher). Não precisa saber o userId: só apaga
// o cookie de desbloqueio da sessão atual.
export async function bloquearAreaRestrita() {
  const jar = await cookies()
  jar.delete(COOKIE_NAME)
}
