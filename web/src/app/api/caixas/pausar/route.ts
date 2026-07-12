import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { eventoId, pausar } = await req.json() as { eventoId: string; pausar: boolean }
  if (!eventoId) return NextResponse.json({ error: 'eventoId obrigatório' }, { status: 400 })

  const admin = createServiceClient()

  const { data: evento } = await admin
    .from('events')
    .select('organization_id')
    .eq('id', eventoId)
    .single()
  if (!evento) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })

  const { data: org } = await admin
    .from('organizations')
    .select('owner_id')
    .eq('id', evento.organization_id)
    .single()
  if (org?.owner_id !== user.id)
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  await admin
    .from('events')
    .update({ vendas_online_pausadas: pausar })
    .eq('id', eventoId)

  return NextResponse.json({ ok: true, pausado: pausar })
}
