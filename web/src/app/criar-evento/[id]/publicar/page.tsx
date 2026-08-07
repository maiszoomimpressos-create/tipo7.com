import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { PublicarClient } from './PublicarClient'
import { isOrgAdmin } from '@/lib/orgAdmin'

interface Props {
  params: Promise<{ id: string }>
}

interface EventoApi {
  id: string; title: string | null; description: string | null; category: string | null
  status: string; date_start: string | null; date_end: string | null
  venue_name: string | null; city: string | null; state: string | null; street: string | null
  ticket_mode: 'individual' | 'pacote' | 'ambos' | null; package_discount_pct: number | null
  banner_url: string | null; organization_id: string; payment_gateway: string | null
  organizations: { owner_id: string | null } | null
}

interface DiasApi {
  dias: Array<{
    day_number: number; date: string; start_time: string | null; end_time: string | null
    event_day_attractions: Array<{ name: string }>
  }>
  ingressos: Array<{ name: string; price: number; quantity: number; event_day_id: string | null }>
}

export default async function PublicarPage({ params }: Props) {
  const { id } = await params

  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/criar-evento')

  const eventoRes = await apiFetchServer(`/api/eventos/${id}`)
  if (eventoRes.status === 404) notFound()
  const evento: EventoApi = await eventoRes.json()

  if (!evento) notFound()
  if (!(await isOrgAdmin(null, evento.organization_id, user.id))) notFound()

  // Conta de pagamento é sempre a do dono da organização — quem publica pode
  // ser um co-admin, mas o dinheiro sempre cai na conta que o dono conectou.
  // O gateway exigido é o escolhido pelo evento — checar sempre Mercado Pago
  // aqui fazia o checklist mostrar "faltando" mesmo com PagBank já conectado
  // (e vice-versa), incoerente com o que /api/eventos/[id]/publicar valida.
  const gateway = evento.payment_gateway === 'pagbank' ? 'pagbank' : 'mercadopago'
  // GET /eventos/:id/gateway-status resolve a conta do DONO da organização
  // no backend — checar /mp/status ou /pagbank/status do usuário logado
  // bloquearia o botão de publicar incorretamente pra um sócio/co-admin
  // publicando por uma organização de outro dono (achado na revisão do G13).
  const gatewayRes = await apiFetchServer(`/api/eventos/${id}/gateway-status`)
  const gatewayData = gatewayRes.ok ? await gatewayRes.json() as { connected: boolean } : { connected: false }
  const gatewayConectado = gatewayData.connected

  // Busca dias e ingressos para o resumo
  const diasRes = await apiFetchServer(`/api/eventos/${id}/dias`)
  const { dias, ingressos }: DiasApi = diasRes.ok
    ? await diasRes.json()
    : { dias: [], ingressos: [] }

  // Calcula número de dias
  const calcDias = () => {
    if (!evento.date_start) return 1
    const inicio = new Date(evento.date_start)
    const fim    = evento.date_end ? new Date(evento.date_end) : inicio
    return Math.max(1, Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  }

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-12">

        {/* Indicador de etapas */}
        <div className="flex items-center gap-2 mb-8">
          <a href={`/criar-evento/${id}`}
            className="flex items-center gap-1.5 text-[#555] hover:text-white text-xs transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <span className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-500 text-[10px]">✓</span>
            Informações
          </a>
          <div className="h-px flex-1 bg-[#1a1a1a]" />
          <a href={`/criar-evento/${id}/ingressos`}
            className="flex items-center gap-1.5 text-[#555] hover:text-white text-xs transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <span className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-500 text-[10px]">✓</span>
            Ingressos
          </a>
          <div className="h-px flex-1 bg-[#1a1a1a]" />
          <a href={`/criar-evento/${id}/imagens`}
            className="flex items-center gap-1.5 text-[#555] hover:text-white text-xs transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <span className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-500 text-[10px]">✓</span>
            Imagens
          </a>
          <div className="h-px flex-1 bg-[#1a1a1a]" />
          <div className="flex items-center gap-1.5 text-white text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <span className="w-5 h-5 rounded-full bg-[#E8B84B] flex items-center justify-center text-[#070707] text-[10px] font-bold">4</span>
            Publicar
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl text-white mb-1"
              style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
            Publicar evento
          </h1>
          <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Revise o resumo e publique quando estiver pronto.
          </p>
        </div>

        <PublicarClient
          eventoId={id}
          statusAtual={evento.status as 'rascunho' | 'publicado' | 'cancelado'}
          gateway={gateway}
          gatewayConectado={gatewayConectado}
          resumo={{
            titulo:      evento.title       ?? '',
            descricao:   evento.description ?? '',
            categoria:   evento.category    ?? '',
            dateStart:   evento.date_start  ?? '',
            dateEnd:     evento.date_end    ?? '',
            numDias:     calcDias(),
            nomeLocal:   evento.venue_name  ?? '',
            cidade:      evento.city        ?? '',
            estado:      evento.state       ?? '',
            rua:         evento.street      ?? '',
            ticketMode:  evento.ticket_mode ?? null,
            packageDiscount: evento.package_discount_pct ?? 0,
            bannerUrl:   evento.banner_url ?? null,
          }}
          dias={dias.map(d => ({
            day_number:  d.day_number,
            date:        d.date,
            start_time:  d.start_time ?? '',
            end_time:    d.end_time   ?? '',
            attractions: (d.event_day_attractions ?? []).map(a => a.name),
          }))}
          ingressos={ingressos.map(t => ({
            name:         t.name,
            price:        t.price,
            quantity:     t.quantity,
            event_day_id: t.event_day_id ?? null,
          }))}
        />

      </main>
    </div>
  )
}
