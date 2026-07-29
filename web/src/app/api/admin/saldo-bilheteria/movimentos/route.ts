import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember, can } from '@/lib/adminAuth'

// Lista o livro-razão de um evento — prova em caso de reclamação do promotor
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const member = await getAdminMember(user.id)
  if (!member || !can(member, 'gerenciar_financeiro')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const eventId = new URL(req.url).searchParams.get('event_id')
  if (!eventId) return NextResponse.json({ error: 'event_id obrigatório' }, { status: 400 })

  const admin = createServiceClient()
  const { data, error } = await admin
    .from('saldo_bilheteria_movimentos')
    .select('id, tipo, valor, saldo_resultante, order_id, criado_em')
    .eq('event_id', eventId)
    .order('criado_em', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ movimentos: data ?? [] })
}
