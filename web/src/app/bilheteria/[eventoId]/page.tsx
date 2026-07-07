import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShieldX } from 'lucide-react'
import { BilheteiroClient } from './BilheteiroClient'

interface Props {
  params: Promise<{ eventoId: string }>
}

export default async function BilheteriaPage({ params }: Props) {
  const { eventoId } = await params
  const supabase     = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?next=/bilheteria/${eventoId}`)

  const admin = createServiceClient()

  // Busca evento e ingressos disponíveis
  const { data: evento } = await admin
    .from('events')
    .select('id, title, date_start, venue_name, city, state, organization_id')
    .eq('id', eventoId)
    .single()

  if (!evento) return <SemPermissao mensagem="Evento não encontrado." />

  // Verifica se é organizador
  const { data: org } = await admin
    .from('organizations')
    .select('owner_id')
    .eq('id', evento.organization_id)
    .single()

  const isOwner = org?.owner_id === user.id

  // Verifica se é staff com permissão vender_ingresso
  let isVendedor = false
  if (!isOwner) {
    const { data: staff } = await admin
      .from('event_staff')
      .select('id, event_positions(event_position_permissions(permission))')
      .eq('event_id', eventoId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (staff) {
      const pos = staff.event_positions as unknown as {
        event_position_permissions: { permission: string }[]
      } | null
      isVendedor = (pos?.event_position_permissions ?? []).some(p => p.permission === 'vender_ingresso')
    }
  }

  if (!isOwner && !isVendedor) {
    return <SemPermissao mensagem="Você não tem permissão para acessar a bilheteria deste evento." />
  }

  // Busca tipos de ingresso
  const { data: tickets } = await admin
    .from('event_tickets')
    .select('id, name, price, quantity')
    .eq('event_id', eventoId)
    .order('price')

  // Calcula vendidos por ticket via order_items (pedidos não cancelados/rejeitados)
  const ticketIds = (tickets ?? []).map(t => t.id)
  let vendidosPorTicket: Record<string, number> = {}

  if (ticketIds.length > 0) {
    const { data: ordensAtivas } = await admin
      .from('orders')
      .select('id')
      .eq('event_id', eventoId)
      .not('status', 'in', '(rejected,cancelled)')

    const orderIds = (ordensAtivas ?? []).map(o => o.id)

    if (orderIds.length > 0) {
      const { data: itens } = await admin
        .from('order_items')
        .select('ticket_id, quantity')
        .in('order_id', orderIds)
        .in('ticket_id', ticketIds)

      for (const item of itens ?? []) {
        vendidosPorTicket[item.ticket_id] = (vendidosPorTicket[item.ticket_id] ?? 0) + (item.quantity ?? 0)
      }
    }
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  return (
    <BilheteiroClient
      eventoId={eventoId}
      eventoTitle={evento.title ?? 'Evento'}
      eventoDate={evento.date_start ?? null}
      eventoLocal={[evento.venue_name, evento.city, evento.state].filter(Boolean).join(' — ')}
      ingressos={(tickets ?? []).map(i => {
        const vendidos = vendidosPorTicket[i.id] ?? 0
        return {
          id:         i.id,
          name:       i.name ?? 'Ingresso',
          price:      Number(i.price ?? 0),
          disponivel: Math.max(0, (i.quantity ?? 0) - vendidos),
        }
      })}
      operadorName={profile?.full_name ?? 'Operador'}
    />
  )
}

function SemPermissao({ mensagem }: { mensagem: string }) {
  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col items-center justify-center px-6 text-center gap-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}
      >
        <ShieldX size={28} className="text-red-400" />
      </div>
      <h1 className="text-white text-xl font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
        Acesso negado
      </h1>
      <p className="text-[#555] text-sm max-w-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        {mensagem}
      </p>
      <a href="/" className="mt-2 text-sm text-[#E8B84B] hover:underline" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        Voltar ao início
      </a>
    </div>
  )
}
