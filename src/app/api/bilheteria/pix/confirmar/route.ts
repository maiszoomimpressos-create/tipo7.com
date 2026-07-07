// POST /api/bilheteria/pix/confirmar
// Confirma pagamento PIX manualmente e gera os ingressos.
// Usado quando o caixa vê o pagamento no celular antes do webhook chegar.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { gerarQrToken } from '@/lib/qrToken'
import { logAudit } from '@/lib/audit'
import { getIp } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin    = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { orderId, comprador } = await req.json() as {
    orderId:   string
    comprador?: { nome?: string; cpf?: string }
  }
  if (!orderId) return NextResponse.json({ error: 'orderId obrigatório' }, { status: 400 })

  // Valida que o pedido pertence ao caixa e está pendente
  const { data: order } = await admin
    .from('orders')
    .select('id, status, event_id')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single()

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  if (order.status !== 'pending' && order.status !== 'approved') {
    return NextResponse.json({ error: 'Pedido não está pendente' }, { status: 409 })
  }

  // Pedido já aprovado pelo webhook — retorna os ingressos existentes
  if (order.status === 'approved') {
    const { data: existingTickets } = await admin
      .from('tickets')
      .select('id, slot_number, qr_token')
      .eq('order_id', orderId)

    const { data: orderItem } = await admin
      .from('order_items')
      .select('ticket_id')
      .eq('order_id', orderId)
      .single()

    const { data: ticketType } = await admin
      .from('event_tickets')
      .select('name')
      .eq('id', orderItem?.ticket_id ?? '')
      .single()

    return NextResponse.json({
      ok:         true,
      tickets:    (existingTickets ?? []).map(t => ({ id: t.id, slot_number: t.slot_number, qr_token: t.qr_token })),
      ticketName: ticketType?.name ?? 'Ingresso',
    })
  }

  // Aprova o pedido
  await admin.from('orders').update({
    status:         'approved',
    payment_method: 'pix',
    updated_at:     new Date().toISOString(),
  }).eq('id', orderId)

  // Busca o order_item
  const { data: orderItem } = await admin.from('order_items').select('id, quantity, ticket_id').eq('order_id', orderId).single()
  if (!orderItem) return NextResponse.json({ error: 'Item do pedido não encontrado' }, { status: 500 })

  // Busca nome do ingresso
  const { data: ticketType } = await admin.from('event_tickets').select('name').eq('id', orderItem.ticket_id).single()

  // Gera os tickets individuais com QR próprio
  const ticketRows = Array.from({ length: orderItem.quantity }, (_, i) => ({
    order_id:      orderId,
    order_item_id: orderItem.id,
    slot_number:   i + 1,
    qr_token:      gerarQrToken(),
  }))

  const { data: tickets, error: ticketErr } = await admin
    .from('tickets')
    .upsert(ticketRows, { onConflict: 'order_item_id,slot_number', ignoreDuplicates: true })
    .select('id, slot_number, qr_token')

  if (ticketErr || !tickets) return NextResponse.json({ error: 'Erro ao gerar ingressos' }, { status: 500 })

  // Salva dados do comprador em ticket_holders
  if (comprador?.nome || comprador?.cpf) {
    const holderRows = tickets.map(t => ({
      order_item_id: orderItem.id,
      slot_number:   t.slot_number,
      full_name:     comprador.nome?.trim() || 'Consumidor',
      cpf:           comprador.cpf?.replace(/\D/g, '') || null,
    }))
    await admin.from('ticket_holders').upsert(holderRows, {
      onConflict: 'order_item_id,slot_number', ignoreDuplicates: false,
    })
  }

  await logAudit({
    userId:       user.id,
    action:       'venda_presencial_pix',
    resourceType: 'order',
    resourceId:   orderId,
    details:      { eventoId: order.event_id, quantidade: orderItem.quantity, confirmacao: 'manual' },
    ip:           getIp(req),
  })

  return NextResponse.json({
    ok:         true,
    tickets:    tickets.map(t => ({ id: t.id, slot_number: t.slot_number, qr_token: t.qr_token })),
    ticketName: ticketType?.name ?? 'Ingresso',
  })
}
