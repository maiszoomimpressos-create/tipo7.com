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

// Define em quais rotas o proxy é executado (exclui assets estáticos)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
