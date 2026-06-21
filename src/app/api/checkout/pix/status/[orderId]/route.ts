// GET /api/checkout/pix/status/[orderId]
// Retorna status do pedido e dados do QR code PIX para polling na tela de pagamento
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()
  const { data: order, error } = await admin
    .from('orders')
    .select('id, status, total, pix_qr_code, pix_qr_code_base64, pix_expires_at, mp_payment_id')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }

  return NextResponse.json({
    status:        order.status,
    total:         order.total,
    qrCode:        order.pix_qr_code,
    qrCodeBase64:  order.pix_qr_code_base64,
    expiresAt:     order.pix_expires_at,
    mpPaymentId:   order.mp_payment_id,
  })
}
