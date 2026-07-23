// Gera código único T7-BR-P-XXXXXXX (promotora) ou T7-BR-E-XXXXXXX (estabelecimento)
// via a function do banco generate_org_code — aleatório com verificação de
// duplicidade, mesmo mecanismo usado pro código de pessoa.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get('tipo') as 'promotora' | 'estabelecimento' | null

  if (tipo !== 'promotora' && tipo !== 'estabelecimento') {
    return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
  }

  // Verifica autenticação
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()
  const { data: codigo, error } = await admin.rpc('generate_org_code', { p_tipo: tipo })

  if (error || !codigo) return NextResponse.json({ error: 'Erro ao gerar código' }, { status: 500 })

  return NextResponse.json({ codigo })
}
