// GET /api/bilheteria/pix/[orderId]
// Polling de status do PIX — retorna status do pedido e dados do QR.
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
  const { data: order } = await admin
    .from('orders')
    .select('id, status, total, pix_qr_code, pix_qr_code_base64, pix_expires_at')
    .eq('id', orderId)
    .eq('user_id', user.id)   // caixa só vê pedidos que ele criou
    .single()

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

  return NextResponse.json({
    status:       order.status,
    total:        order.total,
    qrCode:       order.pix_qr_code,
    qrCodeBase64: order.pix_qr_code_base64,
    expiresAt:    order.pix_expires_at,
  })
}
