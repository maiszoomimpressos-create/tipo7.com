// Rota de callback do Supabase Auth
// O Supabase redireciona o usuário aqui após clicar no link de confirmação de email
// Esta rota troca o código temporário por uma sessão ativa e redireciona para a home
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Sessão criada — redireciona para a página solicitada (ou home)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Se falhou, redireciona para login com mensagem de erro
  return NextResponse.redirect(`${origin}/auth?erro=link_invalido`)
}
