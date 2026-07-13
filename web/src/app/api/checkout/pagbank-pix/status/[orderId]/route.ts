// GET /api/checkout/pagbank-pix/status/[orderId]
// Retorna status do pedido e dados do QR code PIX PagBank para polling na tela de pagamento.
// Espelha o comportamento de /api/checkout/pix/status/[orderId].
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params

  // Verifica autenticação — comprador só pode ver o próprio pedido
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()
  const { data: order, error } = await admin
    .from('orders')
    .select('id, status, total, pagbank_pix_qr_code, pagbank_pix_expires_at, pagbank_charge_id')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }

  return NextResponse.json({
    status:          order.status,
    total:           order.total,
    qrCode:          order.pagbank_pix_qr_code,
    expiresAt:       order.pagbank_pix_expires_at,
    pagbankChargeId: order.pagbank_charge_id,
  })
}
