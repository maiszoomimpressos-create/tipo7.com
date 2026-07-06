// POST /api/trabalhos/responder — aceitar ou recusar convite de equipe
// body: { staffId: string, acao: 'aceitar' | 'recusar' }
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { staffId, acao } = await req.json() as { staffId: string; acao: 'aceitar' | 'recusar' }

  if (!staffId || !['aceitar', 'recusar'].includes(acao)) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const admin = createServiceClient()

  // Garante que o registro pertence ao usuário logado e está pendente
  const { data: registro } = await admin
    .from('event_staff')
    .select('id, user_id, status')
    .eq('id', staffId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (!registro) {
    return NextResponse.json({ error: 'Convite não encontrado ou já respondido' }, { status: 404 })
  }

  const novoStatus = acao === 'aceitar' ? 'active' : 'rejected'

  const { error } = await admin
    .from('event_staff')
    .update({ status: novoStatus })
    .eq('id', staffId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, status: novoStatus })
}
