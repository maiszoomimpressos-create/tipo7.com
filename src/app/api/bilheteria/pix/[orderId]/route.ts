// GET /api/bilheteria/pix/[orderId]
// Polling de status do PIX.
// Consulta o Mercado Pago diretamente quando o pedido ainda está pendente,
// garantindo detecção do pagamento mesmo sem webhook configurado.
import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getMpToken } from '@/lib/mpToken'

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
    .select('id, status, total, pix_qr_code, pix_qr_code_base64, pix_expires_at, mp_payment_id, event_id')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single()

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

  let status = order.status as string

  // Se já aprovado no banco (webhook chegou), retorna imediatamente
  if (status === 'approved') {
    return NextResponse.json({ status, total: order.total })
  }

  // Se ainda pendente, consulta diretamente na API do MP
  if (status === 'pending' && order.mp_payment_id) {
    try {
      // Busca o dono do evento para pegar o token MP dele
      const { data: evento, error: eErr } = await admin
        .from('events')
        .select('organization_id')
        .eq('id', order.event_id)
        .single()

      if (eErr || !evento) {
        console.warn('[pix/polling] evento não encontrado', { orderId, event_id: order.event_id, eErr })
      } else {
        const { data: org, error: oErr } = await admin
          .from('organizations')
          .select('owner_id')
          .eq('id', evento.organization_id)
          .single()

        if (oErr || !org) {
          console.warn('[pix/polling] org não encontrada', { orderId, org_id: evento.organization_id, oErr })
        } else {
          const mpToken = await getMpToken(org.owner_id, admin)

          if (!mpToken) {
            console.warn('[pix/polling] sem token MP para owner', { ownerId: org.owner_id })
          } else {
            const mpClient = new MercadoPagoConfig({ accessToken: mpToken })
            const payment  = new Payment(mpClient)
            const mpData   = await payment.get({ id: order.mp_payment_id })

            console.log('[pix/polling] MP status:', mpData.status, { orderId, mp_payment_id: order.mp_payment_id })

            if (mpData.status === 'approved') {
              await admin
                .from('orders')
                .update({ status: 'approved', updated_at: new Date().toISOString() })
                .eq('id', orderId)
              status = 'approved'
            }
          }
        }
      }
    } catch (err) {
      console.error('[pix/polling] erro ao consultar MP:', err)
    }
  }

  return NextResponse.json({
    status,
    total:        order.total,
    qrCode:       order.pix_qr_code,
    qrCodeBase64: order.pix_qr_code_base64,
    expiresAt:    order.pix_expires_at,
  })
}
