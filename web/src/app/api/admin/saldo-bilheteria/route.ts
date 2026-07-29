import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember, can } from '@/lib/adminAuth'

async function assertFinanceiro() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const member = await getAdminMember(user.id)
  if (!member || !can(member, 'gerenciar_financeiro')) return null
  return user
}

// Lista eventos com saldo de bilheteria ativo
export async function GET() {
  const user = await assertFinanceiro()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createServiceClient()
  const { data: saldos, error } = await admin
    .from('saldo_bilheteria')
    .select('event_id, ativo, bloqueio_ativo, retencao_pct, aviso_pct, meta_reserva, saldo_atual, aviso_disparado, ativado_em')
    .eq('ativo', true)
    .order('ativado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const eventIds = (saldos ?? []).map(s => s.event_id)
  const eventMap: Record<string, string> = {}
  if (eventIds.length) {
    const { data: eventos } = await admin.from('events').select('id, title').in('id', eventIds)
    for (const e of eventos ?? []) eventMap[e.id] = e.title ?? 'Evento'
  }

  const enriched = (saldos ?? []).map(s => ({ ...s, event_title: eventMap[s.event_id] ?? 'Evento' }))
  return NextResponse.json({ saldos: enriched })
}

// Liga/desliga o bloqueio de bilheteria por evento
export async function PATCH(req: NextRequest) {
  const user = await assertFinanceiro()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { event_id, bloqueio_ativo } = await req.json() as { event_id?: string; bloqueio_ativo?: boolean }
  if (!event_id || typeof bloqueio_ativo !== 'boolean') {
    return NextResponse.json({ error: 'event_id e bloqueio_ativo são obrigatórios' }, { status: 400 })
  }

  const admin = createServiceClient()
  const { error } = await admin
    .from('saldo_bilheteria')
    .update({ bloqueio_ativo })
    .eq('event_id', event_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
