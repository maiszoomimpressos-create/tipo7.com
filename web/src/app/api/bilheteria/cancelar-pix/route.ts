// POST /api/bilheteria/cancelar-pix
// Cancela um pedido PIX pendente (expirado) para liberar o estoque reservado.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin    = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { orderId } = await req.json() as { orderId: string }
  if (!orderId) return NextResponse.json({ error: 'orderId obrigatório' }, { status: 400 })

  // Só permite cancelar pedidos 'pending' do próprio usuário
  const { data: order } = await admin
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single()

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  if (order.status !== 'pending') return NextResponse.json({ ok: true }) // já resolvido, ignora

  await admin
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', orderId)

  return NextResponse.json({ ok: true })
}
