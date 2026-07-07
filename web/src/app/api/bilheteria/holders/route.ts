// POST /api/bilheteria/holders
// Salva dados do comprador nos ticket_holders após pagamento aprovado.
// Chamado pela bilheteria na etapa de coleta de dados pós-confirmação de PIX.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin    = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { orderId, comprador } = await req.json() as {
    orderId:   string
    comprador: { nome?: string; cpf?: string; telefone?: string; nascimento?: string }
  }
  if (!orderId) return NextResponse.json({ error: 'orderId obrigatório' }, { status: 400 })

  // Valida que o pedido pertence ao usuário logado e está aprovado
  const { data: order } = await admin
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single()

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  if (order.status !== 'approved') return NextResponse.json({ error: 'Pedido não aprovado' }, { status: 409 })

  const { data: orderItem } = await admin
    .from('order_items')
    .select('id, quantity')
    .eq('order_id', orderId)
    .single()

  if (!orderItem) return NextResponse.json({ error: 'Item do pedido não encontrado' }, { status: 500 })

  const { data: tickets } = await admin
    .from('tickets')
    .select('id, slot_number')
    .eq('order_id', orderId)

  if (!tickets?.length) return NextResponse.json({ error: 'Ingressos não encontrados' }, { status: 500 })

  const holderRows = tickets.map(t => ({
    order_item_id: orderItem.id,
    slot_number:   t.slot_number,
    full_name:     comprador.nome?.trim() || null,
    cpf:           comprador.cpf || null,
    phone:         comprador.telefone || null,
    birth_date:    comprador.nascimento || null,
  }))

  const { error } = await admin.from('ticket_holders').upsert(holderRows, {
    onConflict: 'order_item_id,slot_number',
    ignoreDuplicates: false,
  })

  if (error) {
    console.error('[bilheteria/holders]', error)
    return NextResponse.json({ error: 'Erro ao salvar dados do comprador' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
