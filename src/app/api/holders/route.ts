// API para salvar portadores de ingressos
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const { order_item_id, slot_number, full_name, cpf, email, birth_date } = body

  if (!order_item_id || slot_number == null || !full_name || !cpf || !email || !birth_date) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
  }

  // Verifica que o order_item pertence ao usuário logado
  const { data: item } = await supabase
    .from('order_items')
    .select('id, orders!inner(user_id)')
    .eq('id', order_item_id)
    .single()

  const order = item?.orders as unknown as { user_id: string } | null
  if (!item || order?.user_id !== user.id) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { error } = await supabase
    .from('ticket_holders')
    .upsert({ order_item_id, slot_number, full_name, cpf, email, birth_date }, {
      onConflict: 'order_item_id,slot_number'
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
