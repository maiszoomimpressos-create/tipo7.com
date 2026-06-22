import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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

  // Busca o ingresso pelo token
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

  // Token não existe no banco
  if (!ticket) {
    await admin.from('ticket_validations').insert({
      event_id:  eventoId,
      scanned_by: user.id,
      result:    'invalid',
      raw_token: qr_token,
    })
    return NextResponse.json({ result: 'invalid', message: 'Ingresso não encontrado.' })
  }

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

  // Ingresso cancelado
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

  // Ingresso já utilizado
  if (ticket.status === 'used') {
    // Busca quem validou
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

  // ── Ingresso válido — autoriza entrada ────────────────────────────────────

  // Extrai nome do portador e tipo do ingresso
  const itemData   = ticket.order_items as unknown as {
    event_tickets:  { name: string } | null
    ticket_holders: { slot_number: number; full_name: string }[]
  } | null

  const ticketName  = itemData?.event_tickets?.name ?? 'Ingresso'
  const holderName  = itemData?.ticket_holders?.find(h => h.slot_number === ticket.slot_number)?.full_name ?? null

  // Marca como usado
  await admin
    .from('tickets')
    .update({ status: 'used', validated_at: new Date().toISOString(), validated_by: user.id })
    .eq('id', ticket.id)

  // Registra no log de auditoria
  await admin.from('ticket_validations').insert({
    ticket_id:  ticket.id,
    event_id:   eventoId,
    scanned_by: user.id,
    result:     'valid',
    raw_token:  qr_token,
  })

  return NextResponse.json({
    result:      'valid',
    message:     'Entrada autorizada.',
    holderName,
    ticketName,
  })
}
