// Proxy de autenticação — executado em toda requisição (Next.js 16: renomeado de middleware para proxy)
// Protege rotas privadas redirecionando para login se não houver sessão.
// Fase 6: verifica o JWT do AuthModule próprio localmente (jose, edge-safe)
// em vez de round-trip pra Supabase — mesmo JWT_SECRET do server/.
import { jwtVerify } from 'jose'
import { NextResponse, type NextRequest } from 'next/server'

// Rotas que exigem usuário logado
const ROTAS_PRIVADAS = [
  '/promotor',
  '/comprador',
  '/estabelecimento',
  '/admin',
  '/perfil',
  '/criar-evento',
  '/meus-ingressos',
  '/scanner',
  '/checkout',
  '/dashboard',
  '/bilheteria',
  '/minha-area',
  '/segunda-tela',
]

// Domínios internos permitidos no parâmetro ?next= (evita open redirect)
const DOMINIOS_PERMITIDOS = ['tipo7.com', 'www.tipo7.com', 'localhost']

function isSafeRedirect(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://tipo7.com')
    return DOMINIOS_PERMITIDOS.includes(parsed.hostname)
  } catch { return false }
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? '')

async function getUserFromRequest(request: NextRequest): Promise<{ id: string } | null> {
  const token = request.cookies.get('access_token')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    return typeof payload.sub === 'string' ? { id: payload.sub } : null
  } catch {
    // Cobre tanto token ausente/inválido quanto expirado — nesse caso o
    // usuário é tratado como deslogado aqui (a sessão no browser ainda pode
    // se renovar sozinha via /api/auth/refresh assim que o JS rodar).
    return null
  }
}

export async function proxy(request: NextRequest) {
  const user = await getUserFromRequest(request)
  const pathname = request.nextUrl.pathname

  // Se a rota é privada e o usuário não está logado → redireciona para login
  const ehRotaPrivada = ROTAS_PRIVADAS.some(rota => pathname.startsWith(rota))
  if (ehRotaPrivada && !user) {
    const loginUrl = new URL('/auth', request.url)
    // Só define ?next= se o destino for interno (evita open redirect)
    if (isSafeRedirect(pathname)) loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Se já está logado e tenta acessar /auth → redireciona para home
  if (pathname.startsWith('/auth') && user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next({ request })
}

// Define em quais rotas o proxy é executado — só as que realmente precisam
// (rotas privadas da lista acima + /auth). Verificação é local (jose), sem
// round-trip de rede — mais rápido que a versão anterior mesmo rodando em
// mais rotas.
export const config = {
  matcher: [
    '/promotor/:path*',
    '/comprador/:path*',
    '/estabelecimento/:path*',
    '/admin/:path*',
    '/perfil/:path*',
    '/criar-evento/:path*',
    '/meus-ingressos/:path*',
    '/scanner/:path*',
    '/checkout/:path*',
    '/dashboard/:path*',
    '/bilheteria/:path*',
    '/minha-area/:path*',
    '/segunda-tela/:path*',
    '/auth/:path*',
  ],
}
