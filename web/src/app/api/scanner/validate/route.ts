import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { rateLimit, getIp, tooManyRequests } from '@/lib/rateLimit'
import { logAudit } from '@/lib/audit'

// Verifica se o usuário tem permissão para escanear neste evento.
// Organizador do evento sempre tem acesso; staff precisa ter validar_ingresso.
async function checkPermission(userId: string, eventoId: string): Promise<boolean> {
  const admin = createServiceClient()

  // Verifica se é o organizador
  const { data: evento } = await admin
    .from('events')
    .select('organization_id')
    .eq('id', eventoId)
    .single()
  if (!evento) return false

  const { data: org } = await admin
    .from('organizations')
    .select('owner_id')
    .eq('id', evento.organization_id)
    .single()
  if (org?.owner_id === userId) return true

  // Verifica se é staff com permissão validar_ingresso
  const { data: staff } = await admin
    .from('event_staff')
    .select('id, event_positions(event_position_permissions(permission))')
    .eq('event_id', eventoId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (!staff) return false

  const pos = staff.event_positions as unknown as {
    event_position_permissions: { permission: string }[]
  } | null
  return (pos?.event_position_permissions ?? []).some(p => p.permission === 'validar_ingresso')
}

// POST /api/scanner/validate
// body: { qr_token: string, eventoId: string }
export async function POST(req: NextRequest) {
  if (!(await rateLimit(getIp(req), 'scanner-validate', 30, 60_000))) return tooManyRequests()

  const supabase = await createClient()
  const admin    = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { qr_token, eventoId } = await req.json() as { qr_token: string; eventoId: string }

  if (!qr_token || !eventoId) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  // Permissão
  if (!(await checkPermission(user.id, eventoId))) {
    return NextResponse.json({ error: 'Sem permissão para este evento' }, { status: 403 })
  }

  // ── Tenta primeiro: QR individual (compras online) ───────────────────────
  const { data: ticket } = await admin
    .from('tickets')
    .select(`
      id, status, slot_number, order_id,
      validated_at, validated_by,
      order_items!inner (
        event_tickets (name),
        ticket_holders (slot_number, full_name)
      ),
      orders!inner (event_id)
    `)
    .eq('qr_token', qr_token)
    .single()

  // ── Tenta segundo: QR de lote — order_item_id (compras na bilheteria) ────
  if (!ticket) {
    const { data: orderItem } = await admin
      .from('order_items')
      .select(`
        id, quantity,
        event_tickets (name),
        ticket_holders (full_name),
        orders!inner (event_id, status)
      `)
      .eq('id', qr_token)
      .single()

    if (!orderItem) {
      await admin.from('ticket_validations').insert({
        event_id:   eventoId,
        scanned_by: user.id,
        result:     'invalid',
        raw_token:  qr_token,
      })
      return NextResponse.json({ result: 'invalid', message: 'Ingresso não encontrado.' })
    }

    const orderData = orderItem.orders as unknown as { event_id: string; status: string } | null

    if (orderData?.event_id !== eventoId) {
      return NextResponse.json({ result: 'wrong_event', message: 'Ingresso pertence a outro evento.' })
    }

    if (orderData?.status === 'cancelled' || orderData?.status === 'rejected') {
      return NextResponse.json({ result: 'cancelled', message: 'Pedido cancelado.' })
    }

    // Busca todos os tickets deste order_item
    const { data: loteTickets } = await admin
      .from('tickets')
      .select('id, status')
      .eq('order_item_id', qr_token)

    const todos   = loteTickets ?? []
    const usados  = todos.filter(t => t.status === 'used').length
    const validos = todos.filter(t => t.status === 'valid')

    if (validos.length === 0) {
      return NextResponse.json({
        result:     'already_used',
        message:    `Todos os ${todos.length} ingressos deste lote já foram utilizados.`,
        validatedAt: null,
        validatedBy: null,
      })
    }

    // Marca todos os tickets válidos do lote como usados
    await admin
      .from('tickets')
      .update({ status: 'used', validated_at: new Date().toISOString(), validated_by: user.id })
      .in('id', validos.map(t => t.id))

    const itemData   = orderItem as unknown as { event_tickets: { name: string } | null; ticket_holders: { full_name: string }[] }
    const ticketName = itemData?.event_tickets?.name ?? 'Ingresso'
    const holderName = itemData?.ticket_holders?.[0]?.full_name ?? null
    const quantidade = validos.length

    await logAudit({
      userId:       user.id,
      action:       'validar_ingresso',
      resourceType: 'order_item',
      resourceId:   qr_token,
      details:      { eventoId, result: 'valid', holderName, ticketName, quantidade, tipo: 'lote' },
      ip:           getIp(req),
    })

    return NextResponse.json({
      result:     'valid',
      message:    `Entrada autorizada — ${quantidade} ${quantidade === 1 ? 'pessoa' : 'pessoas'}.`,
      holderName,
      ticketName,
      quantidade,
      tipo:       'lote',
      jaUsados:   usados > 0 ? usados : undefined,
    })
  }

  // ── Fluxo individual (online) ─────────────────────────────────────────────

  // Ingresso pertence a outro evento
  const orderData = ticket.orders as unknown as { event_id: string } | null
  if (orderData?.event_id !== eventoId) {
    await admin.from('ticket_validations').insert({
      ticket_id:  ticket.id,
      event_id:   eventoId,
      scanned_by: user.id,
      result:     'wrong_event',
      raw_token:  qr_token,
    })
    return NextResponse.json({ result: 'wrong_event', message: 'Ingresso pertence a outro evento.' })
  }

  if (ticket.status === 'cancelled') {
    await admin.from('ticket_validations').insert({
      ticket_id:  ticket.id,
      event_id:   eventoId,
      scanned_by: user.id,
      result:     'cancelled',
      raw_token:  qr_token,
    })
    return NextResponse.json({ result: 'cancelled', message: 'Ingresso cancelado.' })
  }

  if (ticket.status === 'used') {
    const { data: lastValidation } = await admin
      .from('ticket_validations')
      .select('scanned_at, profiles:scanned_by(full_name)')
      .eq('ticket_id', ticket.id)
      .eq('result', 'valid')
      .order('scanned_at', { ascending: false })
      .limit(1)
      .single()

    await admin.from('ticket_validations').insert({
      ticket_id:  ticket.id,
      event_id:   eventoId,
      scanned_by: user.id,
      result:     'already_used',
      raw_token:  qr_token,
    })

    const validado = lastValidation as unknown as {
      scanned_at: string
      profiles: { full_name: string | null } | null
    } | null

    return NextResponse.json({
      result:      'already_used',
      message:     'Este ingresso já foi utilizado.',
      validatedAt: validado?.scanned_at ?? null,
      validatedBy: (validado?.profiles as { full_name: string | null } | null)?.full_name ?? 'Desconhecido',
    })
  }

  // ── Ingresso individual válido ────────────────────────────────────────────
  const itemData   = ticket.order_items as unknown as {
    event_tickets:  { name: string } | null
    ticket_holders: { slot_number: number; full_name: string }[]
  } | null

  const ticketName  = itemData?.event_tickets?.name ?? 'Ingresso'
  const holderName  = itemData?.ticket_holders?.find(h => h.slot_number === ticket.slot_number)?.full_name ?? null

  const { data: marcado } = await admin
    .from('tickets')
    .update({ status: 'used', validated_at: new Date().toISOString(), validated_by: user.id })
    .eq('id', ticket.id)
    .eq('status', 'valid')
    .select('id')

  if (!marcado || marcado.length === 0) {
    await admin.from('ticket_validations').insert({
      ticket_id:  ticket.id,
      event_id:   eventoId,
      scanned_by: user.id,
      result:     'already_used',
      raw_token:  qr_token,
    })
    return NextResponse.json({ result: 'already_used', message: 'Este ingresso já foi utilizado.' })
  }

  await admin.from('ticket_validations').insert({
    ticket_id:  ticket.id,
    event_id:   eventoId,
    scanned_by: user.id,
    result:     'valid',
    raw_token:  qr_token,
  })

  await logAudit({
    userId:       user.id,
    action:       'validar_ingresso',
    resourceType: 'ticket',
    resourceId:   ticket.id,
    details:      { eventoId, result: 'valid', holderName, ticketName },
    ip:           getIp(req),
  })

  return NextResponse.json({
    result:      'valid',
    message:     'Entrada autorizada.',
    holderName,
    ticketName,
    quantidade:  1,
  })
}
