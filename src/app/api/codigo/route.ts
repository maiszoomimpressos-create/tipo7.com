// Gera código único sequencial para promotor (T7-PRO-XXXXX) ou estabelecimento (T7-EST-XXXXX)
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

  // Service client para contar todos os orgs (bypassa RLS)
  const admin = createServiceClient()
  const { count } = await admin
    .from('organizations')
    .select('*', { count: 'exact', head: true })
    .eq('type', tipo)

  const prefix = tipo === 'promotora' ? 'T7-PRO' : 'T7-EST'
  const codigo = `${prefix}-${String((count ?? 0) + 1).padStart(5, '0')}`

  return NextResponse.json({ codigo })
}
