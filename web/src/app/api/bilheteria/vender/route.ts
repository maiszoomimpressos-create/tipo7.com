import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { gerarQrToken } from '@/lib/qrToken'
import { rateLimit, getIp, tooManyRequests } from '@/lib/rateLimit'
import { logAudit } from '@/lib/audit'

// Verifica se o usuário tem permissão de bilheteria para o evento
async function checkPermissaoBilheteria(userId: string, eventoId: string): Promise<boolean> {
  const admin = createServiceClient()

  // Organizador sempre tem acesso
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

  // Staff com permissão vender_ingresso
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
  return (pos?.event_position_permissions ?? []).some(p => p.permission === 'vender_ingresso')
}

// POST /api/bilheteria/vender
// body: { eventoId, ticketId, quantidade, comprador: { nome, cpf, telefone, dataNascimento } }
export async function POST(req: NextRequest) {
  if (!(await rateLimit(getIp(req), 'bilheteria-vender', 60, 60_000))) return tooManyRequests()

  const supabase = await createClient()
  const admin    = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as {
    eventoId:         string
    ticketId:         string
    quantidade:       number
    metodoPagamento?: string
    comprador: {
      nome:           string
      cpf:            string
      telefone:       string
      dataNascimento: string
    }
  }

  const { eventoId, ticketId, quantidade, metodoPagamento, comprador } = body

  if (!eventoId || !ticketId || !quantidade) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  if (!(await checkPermissaoBilheteria(user.id, eventoId))) {
    return NextResponse.json({ error: 'Sem permissão para este evento' }, { status: 403 })
  }

  // Cria o pedido atomicamente usando a mesma RPC do checkout online
  const { data: ticket } = await admin
    .from('event_tickets')
    .select('id, name, price')
    .eq('id', ticketId)
    .eq('event_id', eventoId)
    .single()

  if (!ticket) return NextResponse.json({ error: 'Ingresso não encontrado' }, { status: 404 })

  const { data: resultado, error: rpcError } = await admin.rpc('criar_pedido_atomico', {
    p_user_id:  user.id,
    p_event_id: eventoId,
    p_items: [{
      ticket_id:  ticketId,
      quantity:   quantidade,
      unit_price: Number(ticket.price ?? 0),
    }],
  })

  if (rpcError) return NextResponse.json({ error: 'Erro ao reservar ingresso' }, { status: 500 })

  if (resultado?.error === 'sem_estoque') {
    return NextResponse.json(
      { error: `Ingresso esgotado. Restam ${resultado.disponivel ?? 0}.` },
      { status: 409 }
    )
  }

  if (!resultado?.order_id) {
    return NextResponse.json({ error: 'Erro ao criar pedido' }, { status: 500 })
  }

  const orderId = resultado.order_id as string

  // Marca pedido como aprovado (pagamento presencial)
  await admin
    .from('orders')
    .update({
      status:         'approved',
      payment_method: metodoPagamento ?? 'dinheiro',
      updated_at:     new Date().toISOString(),
    })
    .eq('id', orderId)

  // Busca o order_item criado
  const { data: orderItem } = await admin
    .from('order_items')
    .select('id')
    .eq('order_id', orderId)
    .single()

  if (!orderItem) return NextResponse.json({ error: 'Erro ao buscar item do pedido' }, { status: 500 })

  // Gera os tickets com QR token para cada slot
  const ticketRows = Array.from({ length: quantidade }, (_, i) => ({
    order_id:      orderId,
    order_item_id: orderItem.id,
    slot_number:   i + 1,
    qr_token:      gerarQrToken(),
  }))

  const { data: tickets, error: ticketErr } = await admin
    .from('tickets')
    .insert(ticketRows)
    .select('id, slot_number, qr_token')

  if (ticketErr || !tickets) {
    return NextResponse.json({ error: 'Erro ao gerar ingressos' }, { status: 500 })
  }

  // Salva os dados do comprador em ticket_holders (nome pode ser anônimo)
  const holderRows = tickets.map(t => ({
    order_item_id:  orderItem.id,
    slot_number:    t.slot_number,
    full_name:      comprador.nome?.trim() || 'Consumidor',
    cpf:            comprador.cpf?.trim()            || null,
    phone:          comprador.telefone?.trim()        || null,
    birth_date:     comprador.dataNascimento?.trim()  || null,
  }))

  await admin.from('ticket_holders').upsert(holderRows, {
    onConflict:       'order_item_id,slot_number',
    ignoreDuplicates: false,
  })

  await logAudit({
    userId:       user.id,
    action:       'venda_presencial',
    resourceType: 'order',
    resourceId:   orderId,
    details:      { eventoId, ticketId, quantidade, comprador: comprador.nome || 'Consumidor', metodoPagamento: metodoPagamento ?? 'dinheiro' },
    ip:           getIp(req),
  })

  return NextResponse.json({
    ok:      true,
    orderId,
    tickets: tickets.map(t => ({ id: t.id, slot_number: t.slot_number, qr_token: t.qr_token })),
    ticketName: ticket.name,
  })
}
