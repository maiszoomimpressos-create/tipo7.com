import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { hasEventPermission } from '@/lib/eventPermissions'

// GET /api/estacionamento/[eventoId]/sessoes?status=aberto
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventoId: string }> }
) {
  const { eventoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Entrada e saída precisam ler a ocupação (contagem de vagas), mesmo quem
  // só registra entrada precisa saber se está lotado.
  if (!(await hasEventPermission(user.id, eventoId, ['estacionamento_entrada', 'estacionamento_saida']))) {
    return NextResponse.json({ error: 'Sem permissão para este evento' }, { status: 403 })
  }

  const status = req.nextUrl.searchParams.get('status') ?? 'aberto'

  const admin = createServiceClient()
  const { data: estacionamentos } = await admin
    .from('estacionamentos')
    .select('id')
    .eq('event_id', eventoId)

  const ids = (estacionamentos ?? []).map(e => e.id)
  if (ids.length === 0) return NextResponse.json({ sessoes: [] })

  const { data: sessoes } = await admin
    .from('estacionamento_sessoes')
    .select('*, estacionamentos(nome)')
    .in('estacionamento_id', ids)
    .eq('status', status)
    .order('entrada_em', { ascending: false })

  return NextResponse.json({ sessoes: sessoes ?? [] })
}
