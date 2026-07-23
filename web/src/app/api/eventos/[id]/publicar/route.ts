import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/eventos/[id]/publicar
// Revalida no servidor os mesmos requisitos que a tela já mostra (título, data,
// local, ingressos válidos) e — o mais importante — se o dono tem Mercado Pago
// conectado. Sem isso, o dinheiro de venda online cairia na conta da própria
// Tipo7 (o fallback de checkout/route.ts), o que gera imposto sobre o valor
// cheio em vez de só os 10% de taxa. Por isso a publicação fica bloqueada até
// o promotor conectar a própria conta.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()

  const { data: evento } = await admin
    .from('events')
    .select('id, title, date_start, city, venue_name, organization_id, payment_gateway')
    .eq('id', id)
    .single()
  if (!evento) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })

  const { data: org } = await admin
    .from('organizations')
    .select('owner_id')
    .eq('id', evento.organization_id)
    .single()
  if (org?.owner_id !== user.id) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { data: ingressos } = await admin
    .from('event_tickets')
    .select('name, quantity')
    .eq('event_id', id)

  // Gateway do evento define qual conta é exigida — cada um tem sua própria
  // tabela de contas conectadas (promotor_mp_accounts / promotor_pagbank_accounts).
  const gateway = evento.payment_gateway === 'pagbank' ? 'pagbank' : 'mercadopago'

  const { data: contaGateway } = await admin
    .from(gateway === 'pagbank' ? 'promotor_pagbank_accounts' : 'promotor_mp_accounts')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  const faltando: string[] = []
  if (!evento.title)                                                              faltando.push('título')
  if (!evento.date_start)                                                         faltando.push('data')
  if (!evento.city && !evento.venue_name)                                         faltando.push('local')
  if (!ingressos?.length || !ingressos.every(t => t.name && (t.quantity ?? 0) > 0)) faltando.push('ingressos')
  if (!contaGateway) faltando.push(`conta ${gateway === 'pagbank' ? 'PagBank' : 'Mercado Pago'} conectada`)

  if (faltando.length > 0) {
    return NextResponse.json(
      { error: `Não é possível publicar — faltando: ${faltando.join(', ')}.` },
      { status: 400 }
    )
  }

  const { error } = await admin.from('events').update({ status: 'publicado' }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Erro ao publicar evento' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
