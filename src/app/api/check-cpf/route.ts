// GET /api/check-cpf?cpf=12345678901
// Verifica se um CPF já está cadastrado na plataforma (sem expor dados do usuário)
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const cpf = req.nextUrl.searchParams.get('cpf')?.replace(/\D/g, '')
  if (!cpf || cpf.length !== 11) {
    return NextResponse.json({ exists: false })
  }

  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('cpf', cpf)

  return NextResponse.json({ exists: (count ?? 0) > 0 })
}
