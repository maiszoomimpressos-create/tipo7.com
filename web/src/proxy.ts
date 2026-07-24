// Proxy de autenticação — executado em toda requisição (Next.js 16: renomeado de middleware para proxy)
// Protege rotas privadas redirecionando para login se não houver sessão
import { createServerClient } from '@supabase/ssr'
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

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })

  // Cria o cliente Supabase com leitura/escrita de cookies para manter sessão
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Verifica sessão do usuário
  const { data: { user } } = await supabase.auth.getUser()

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

  return response
}

// Define em quais rotas o proxy é executado — só as que realmente precisam
// (rotas privadas da lista acima + /auth). Antes rodava em praticamente toda
// requisição (inclusive /api/* e páginas públicas), custando uma chamada de
// rede ao Supabase (150-870ms observados) sem nenhum efeito útil nelas —
// rotas de API já fazem seu próprio getUser() dentro do handler.
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
