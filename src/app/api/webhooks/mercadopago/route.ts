import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createServiceClient } from '@/lib/supabase/server'

const STATUS_MAP: Record<string, string> = {
  approved:   'approved',
  pending:    'in_process',
  in_process: 'in_process',
  rejected:   'rejected',
  cancelled:  'cancelled',
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { type?: string; data?: { id?: string | number } }

  // MP envia vários tipos de notificação — só processa pagamentos
  if (body.type !== 'payment') return NextResponse.json({ ok: true })

  const paymentId = body.data?.id
  if (!paymentId) return NextResponse.json({ ok: true })

  // Busca detalhes do pagamento na API do MP
  const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
  const payment  = new Payment(mpClient)
  const paymentData = await payment.get({ id: String(paymentId) })

  const orderId = paymentData.external_reference
  if (!orderId) return NextResponse.json({ ok: true })

  const newStatus = STATUS_MAP[paymentData.status ?? ''] ?? 'pending'

  const admin = createServiceClient()

  await admin
    .from('orders')
    .update({
      status:         newStatus,
      mp_payment_id:  String(paymentId),
      updated_at:     new Date().toISOString(),
    })
    .eq('id', orderId)

  // Gera um ticket por slot apenas quando o pagamento for aprovado
  if (newStatus === 'approved') {
    const { data: items } = await admin
      .from('order_items')
      .select('id, quantity')
      .eq('order_id', orderId)

    if (items && items.length > 0) {
      const ticketRows = items.flatMap(item =>
        Array.from({ length: item.quantity }, (_, i) => ({
          order_id:      orderId,
          order_item_id: item.id,
          slot_number:   i + 1,
        }))
      )

      // ignoreDuplicates evita erro se o webhook disparar mais de uma vez
      await admin
        .from('tickets')
        .upsert(ticketRows, { onConflict: 'order_item_id,slot_number', ignoreDuplicates: true })
    }
  }

  return NextResponse.json({ ok: true })
}
