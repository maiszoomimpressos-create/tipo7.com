import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ error: 'Parâmetro q obrigatório' }, { status: 400 })

  const admin = createServiceClient()
  let targetId:   string | null = null
  let targetNome: string | null = null

  if (q.toUpperCase().startsWith('T7-USR-')) {
    const { data: perfil } = await admin
      .from('profiles')
      .select('id, full_name')
      .eq('user_code', q.toUpperCase())
      .maybeSingle()
    targetId   = perfil?.id ?? null
    targetNome = perfil?.full_name ?? null
  } else {
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const found = users.find(u => u.email?.toLowerCase() === q.toLowerCase())
    if (found) {
      targetId = found.id
      const { data: perfil } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', found.id)
        .maybeSingle()
      targetNome = perfil?.full_name ?? found.email ?? null
    }
  }

  if (!targetId) {
    return NextResponse.json({ error: 'Usuário não encontrado. Verifique o email ou código T7-USR.' }, { status: 404 })
  }

  return NextResponse.json({ id: targetId, nome: targetNome })
}
