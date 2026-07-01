import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// PATCH /api/ingressos/[id]
// Atualiza nome, preço e/ou quantidade de um tipo de ingresso.
// Regras: quantidade >= vendidos; soma de todos <= capacidade do evento.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ticketId } = await params
  const supabase         = await createClient()
  const admin            = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Busca o ingresso e o evento vinculado
  const { data: ticket } = await admin
    .from('event_tickets')
    .select('id, event_id, quantity')
    .eq('id', ticketId)
    .single()

  if (!ticket) return NextResponse.json({ error: 'Ingresso não encontrado' }, { status: 404 })

  // Verifica se o usuário é dono do evento
  const { data: evento } = await admin
    .from('events')
    .select('id, capacity, organization_id')
    .eq('id', ticket.event_id)
    .single()

  if (!evento) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })

  const { data: org } = await admin
    .from('organizations')
    .select('owner_id')
    .eq('id', evento.organization_id)
    .single()

  if (org?.owner_id !== user.id) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json() as {
    name?:     string
    price?:    number
    quantity?: number
  }

  // Valida quantidade se informada
  if (body.quantity !== undefined) {
    // 1. Não pode ser menor que o total já vendido
    const { data: soldRows } = await admin
      .from('order_items')
      .select('quantity, orders!inner(status, event_id)')
      .eq('ticket_id', ticketId)
      .eq('orders.status', 'approved')

    const totalSold = (soldRows ?? []).reduce((sum, r) => sum + (r.quantity ?? 0), 0)

    if (body.quantity < totalSold) {
      return NextResponse.json(
        { error: `Quantidade mínima é ${totalSold} (já vendidos). Você não pode remover ingressos já vendidos.` },
        { status: 400 }
      )
    }

    // 2. Soma de todos os tipos não pode ultrapassar a capacidade
    if (evento.capacity) {
      const { data: outrosIngressos } = await admin
        .from('event_tickets')
        .select('id, quantity')
        .eq('event_id', ticket.event_id)
        .neq('id', ticketId)

      const somaOutros = (outrosIngressos ?? []).reduce((sum, t) => sum + (t.quantity ?? 0), 0)

      if (somaOutros + body.quantity > evento.capacity) {
        const disponivel = evento.capacity - somaOutros
        return NextResponse.json(
          { error: `Capacidade insuficiente. Máximo disponível para este tipo: ${disponivel} (capacidade total: ${evento.capacity}).` },
          { status: 400 }
        )
      }
    }
  }

  // Monta apenas os campos que foram enviados
  const updates: Record<string, unknown> = {}
  if (body.name     !== undefined) updates.name     = body.name.trim()
  if (body.price    !== undefined) updates.price    = body.price
  if (body.quantity !== undefined) updates.quantity = body.quantity

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const { error } = await admin
    .from('event_tickets')
    .update(updates)
    .eq('id', ticketId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
