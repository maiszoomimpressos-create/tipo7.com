// Emissão de ingressos após confirmação de pagamento.
// Lógica extraída do webhook do Mercado Pago e reutilizada por todos os gateways.
//
// Fluxo:
//   1. Busca order_items do pedido aprovado
//   2. Gera tickets com QR tokens únicos (upsert — idempotente)
//   3. Busca dados completos para o email
//   4. Envia email com todos os ingressos ao comprador
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTicketEmail } from '@/lib/email'
import { gerarQrToken }   from '@/lib/qrToken'

// Emite ingressos para um pedido aprovado e envia email ao comprador.
// Esta função é idempotente: reenviar com o mesmo orderId não cria duplicatas
// (o upsert usa o conflito em order_item_id + slot_number).
export async function issueTickets(
  orderId: string,
  admin:   SupabaseClient,
): Promise<void> {
  // Busca itens do pedido com nome do tipo de ingresso
  const { data: items } = await admin
    .from('order_items')
    .select('id, quantity, event_tickets(name)')
    .eq('order_id', orderId)

  if (!items || items.length === 0) return

  // Gera uma linha na tabela tickets para cada unidade comprada
  const ticketRows = items.flatMap(item =>
    Array.from({ length: item.quantity }, (_, i) => ({
      order_id:      orderId,
      order_item_id: item.id,
      slot_number:   i + 1,
      qr_token:      gerarQrToken(),
    }))
  )

  // Upsert garante idempotência: se os tickets já existem, não sobrescreve os QR tokens
  await admin
    .from('tickets')
    .upsert(ticketRows, { onConflict: 'order_item_id,slot_number', ignoreDuplicates: true })

  // Busca os tickets recém-gerados (ou já existentes) para montar o email
  const { data: generatedTickets } = await admin
    .from('tickets')
    .select('order_item_id, slot_number, qr_token')
    .eq('order_id', orderId)

  // Busca dados do pedido, evento e perfil do comprador para o email
  const { data: order } = await admin
    .from('orders')
    .select(`
      user_id,
      events (title, date_start, venue_name, city, state, banner_url),
      profiles:user_id (full_name)
    `)
    .eq('id', orderId)
    .single()

  // Não envia email se a chave Resend não estiver configurada (dev local sem email)
  if (!order || !generatedTickets || !process.env.RESEND_API_KEY) return

  const { data: { user } } = await admin.auth.admin.getUserById(order.user_id)
  if (!user?.email) return

  // Extrai dados de tipos complexos retornados pelo Supabase (objeto ou array)
  const rawEvent   = order.events   as unknown as { title: string; date_start: string | null; venue_name: string | null; city: string | null; state: string | null; banner_url: string | null } | null
  const rawProfile = order.profiles as unknown as { full_name: string | null } | null
  const event      = Array.isArray(rawEvent)   ? rawEvent[0]   : rawEvent
  const profile    = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile
  const buyerName  = profile?.full_name ?? 'Cliente'

  // Monta lista de ingressos para o template do email
  const ticketEmailList = generatedTickets.map(t => {
    const item       = items.find(i => i.id === t.order_item_id)
    const rawTicket  = item?.event_tickets as unknown
    const ticketData = Array.isArray(rawTicket)
      ? rawTicket[0] as { name: string }
      : rawTicket as { name: string } | null
    return {
      ticket_name: ticketData?.name ?? 'Ingresso',
      slot_number: t.slot_number,
      qr_token:    t.qr_token,
    }
  })

  await sendTicketEmail({
    to:        user.email,
    buyerName,
    event:     event ?? { title: 'Evento', date_start: null, venue_name: null, city: null, state: null, banner_url: null },
    tickets:   ticketEmailList,
  }).catch(err => console.error('[issueTickets] falha ao enviar email:', err))
}
