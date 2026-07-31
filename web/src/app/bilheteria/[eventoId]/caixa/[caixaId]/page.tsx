import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShieldX } from 'lucide-react'
import { BilheteiroClient } from '../../BilheteiroClient'
import { getEventosVendaveisNoCaixa } from '@/lib/eventFamily'
import { isOrgAdmin } from '@/lib/orgAdmin'

interface Props {
  params: Promise<{ eventoId: string; caixaId: string }>
}

export default async function CaixaPage({ params }: Props) {
  const { eventoId, caixaId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?next=/bilheteria/${eventoId}/caixa/${caixaId}`)

  const admin = createServiceClient()

  const { data: caixa } = await admin
    .from('caixas')
    .select('id, nome, status, operador_id, evento_id, ingressos_alocados, fundo_inicial')
    .eq('id', caixaId)
    .single()

  if (!caixa || caixa.evento_id !== eventoId)
    return <SemPermissao mensagem="Caixa não encontrado." />

  if (caixa.status === 'fechado')
    return <SemPermissao mensagem="Este caixa já foi fechado." />
  if (caixa.status === 'fechamento_pendente')
    return <SemPermissao mensagem="A contagem deste caixa já foi enviada — aguardando validação do organizador." />

  const { data: evento } = await admin
    .from('events')
    .select('id, title, date_start, venue_name, city, state, organization_id')
    .eq('id', eventoId)
    .single()

  if (!evento) return <SemPermissao mensagem="Evento não encontrado." />

  const isOwner    = await isOrgAdmin(admin, evento.organization_id, user.id)
  const isOperador = caixa.operador_id === user.id

  // Também permite staff com permissão vender_ingresso (sem caixa designado)
  let isVendedor = false
  if (!isOwner && !isOperador) {
    const { data: staff } = await admin
      .from('event_staff')
      .select('id, event_positions(event_position_permissions(permission))')
      .eq('event_id', eventoId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()
    if (staff) {
      const pos = staff.event_positions as unknown as { event_position_permissions: { permission: string }[] } | null
      isVendedor = (pos?.event_position_permissions ?? []).some(p => p.permission === 'vender_ingresso')
    }
  }

  if (!isOwner && !isOperador && !isVendedor)
    return <SemPermissao mensagem="Você não tem permissão para acessar este caixa." />

  // Busca tipos de ingresso e estoque de toda a família vendável neste caixa
  // (o próprio evento + filhos que optaram por vender no caixa do pai)
  const eventosVendaveis = await getEventosVendaveisNoCaixa(admin, eventoId)
  const eventoIdsVendaveis = eventosVendaveis.map(e => e.id)
  const eventoTituloMap: Record<string, string> = Object.fromEntries(eventosVendaveis.map(e => [e.id, e.title]))

  const { data: ticketsRaw } = await admin
    .from('event_tickets')
    .select('id, name, price, quantity, event_id')
    .in('event_id', eventoIdsVendaveis)
    .order('price')

  // Agrupa por evento (pai primeiro, depois filhos, na ordem de eventosVendaveis)
  // antes de ordenar por preço dentro de cada grupo — evita intercalar eventos
  // diferentes no seletor, o que quebraria os cabeçalhos de grupo na UI.
  const ordemEvento = new Map(eventoIdsVendaveis.map((id, i) => [id, i]))
  const tickets = [...(ticketsRaw ?? [])].sort((a, b) => {
    const posA = ordemEvento.get(a.event_id) ?? 0
    const posB = ordemEvento.get(b.event_id) ?? 0
    return posA !== posB ? posA - posB : Number(a.price) - Number(b.price)
  })

  const ticketIds = (tickets ?? []).map(t => t.id)
  let vendidosPorTicket: Record<string, number> = {}

  if (ticketIds.length > 0) {
    const { data: ordensAtivas } = await admin
      .from('orders')
      .select('id')
      .in('event_id', eventoIdsVendaveis)
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

  // Calcula saldo de ingressos físicos do caixa
  const { data: transferencias } = await admin
    .from('caixa_transferencias')
    .select('caixa_origem_id, caixa_destino_id, quantidade')
    .or(`caixa_origem_id.eq.${caixaId},caixa_destino_id.eq.${caixaId}`)

  const recebidos = (transferencias ?? [])
    .filter(t => t.caixa_destino_id === caixaId)
    .reduce((s, t) => s + t.quantidade, 0)
  const enviados = (transferencias ?? [])
    .filter(t => t.caixa_origem_id === caixaId)
    .reduce((s, t) => s + t.quantidade, 0)
  const { data: vendasCaixa } = await admin
    .from('orders')
    .select('id')
    .eq('caixa_id', caixaId)
    .not('status', 'in', '(rejected,cancelled)')
  const vcIds = (vendasCaixa ?? []).map(o => o.id)
  let vendidosCaixa = 0
  if (vcIds.length > 0) {
    const { data: itensCaixa } = await admin.from('order_items').select('quantity').in('order_id', vcIds)
    vendidosCaixa = (itensCaixa ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0)
  }
  const saldoIngressos = caixa.ingressos_alocados + recebidos - enviados - vendidosCaixa

  return (
    <BilheteiroClient
      eventoId={eventoId}
      caixaId={caixaId}
      caixaNome={caixa.nome}
      saldoIngressos={saldoIngressos}
      isOwner={isOwner}
      eventoTitle={evento.title ?? 'Evento'}
      eventoDate={evento.date_start ?? null}
      eventoLocal={[evento.venue_name, evento.city, evento.state].filter(Boolean).join(' — ')}
      ingressos={(tickets ?? []).map(i => {
        const vendidos = vendidosPorTicket[i.id] ?? 0
        return {
          id:          i.id,
          name:        i.name ?? 'Ingresso',
          price:       Number(i.price ?? 0),
          disponivel:  Math.max(0, (i.quantity ?? 0) - vendidos),
          eventoId:    i.event_id,
          eventoTitle: eventoTituloMap[i.event_id] ?? evento.title ?? 'Evento',
        }
      })}
      operadorName={profile?.full_name ?? 'Operador'}
    />
  )
}

function SemPermissao({ mensagem }: { mensagem: string }) {
  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
           style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
        <ShieldX size={28} className="text-red-400" />
      </div>
      <h1 className="text-white text-xl font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
        Acesso negado
      </h1>
      <p className="text-[#555] text-sm max-w-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        {mensagem}
      </p>
      <a href="/" className="mt-2 text-sm hover:underline" style={{ color: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
        Voltar ao início
      </a>
    </div>
  )
}
