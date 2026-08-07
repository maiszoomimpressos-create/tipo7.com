import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect, notFound } from 'next/navigation'
import { Header }     from '@/components/layout/Header'
import { EventoForm } from './EventoForm'
import { MPConnect }  from './MPConnect'
import { FileEdit, ImagePlus } from 'lucide-react'
import { isOrgAdmin } from '@/lib/orgAdmin'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarEventoPage({ params }: Props) {
  const { id }   = await params

  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/criar-evento')

  const eventoRes = await apiFetchServer(`/api/eventos/${id}`)
  if (eventoRes.status === 404) notFound()
  const evento = await eventoRes.json() as {
    id: string; title: string | null; description: string | null; category: string | null
    date_start: string | null; date_end: string | null
    venue_name: string | null; venue_id: string | null
    zip_code: string | null; street: string | null; street_number: string | null
    neighborhood: string | null; city: string | null; state: string | null; complement: string | null
    capacity: number | null; status: string; banner_url: string | null
    fee_mode: string | null; payment_gateway: string | null
    parent_event_id: string | null; modulo_tenda: boolean; modulo_estacionamento: boolean
    permitir_venda_no_caixa_pai: boolean | null; organization_id: string
    lat: number | null; lng: number | null
    organizations: { cnpj: string | null; owner_id: string | null } | null
  }

  if (!evento) notFound()
  if (!(await isOrgAdmin(null, evento.organization_id, user.id))) notFound()

  // PJ ou PF é derivado da própria organização (tem CNPJ ou não) — não é
  // mais uma pergunta/flag separada do usuário (ver PromotorForm em /perfil)
  const orgData = Array.isArray(evento.organizations)
    ? evento.organizations[0]
    : evento.organizations as { cnpj: string | null; owner_id: string | null } | null
  const tipoPessoa: 'pf' | 'pj' = orgData?.cnpj ? 'pj' : 'pf'
  const orgOwnerId = orgData?.owner_id ?? null

  const profileRes = await apiFetchServer('/api/profile')
  const profile = profileRes.ok ? await profileRes.json() as {
    full_name: string | null; cpf: string | null; phone: string | null; city: string | null; state: string | null
  } : null

  // Contas de pagamento conectadas pelo dono da organização — decide quais
  // gateways o promotor pode escolher pro evento (PagBank fica travado até
  // o checkout dele estar pronto no frontend, mesmo que a conta já esteja
  // conectada em Configurações > Contas)
  // LIMITAÇÃO CONHECIDA (Fase 7.2, G13): /mp/status e /pagbank/status só
  // respondem pelo usuário autenticado (via JWT), não aceitam um userId
  // arbitrário — diferente da query original, que checava sempre o dono
  // real da organização (orgOwnerId), podendo ser outra pessoa quando quem
  // edita é um sócio/co-admin. Nesse caso específico (sócio editando evento
  // de organização de outro dono) o indicador visual mpConectado/pagbankConectado
  // pode ficar incorreto (mostra a conta de quem está logado, não a do
  // dono) — só afeta a UI desta tela, não o fluxo real de pagamento (que
  // resolve a conta certa no backend na hora de publicar/vender). Ver
  // relatório desta tarefa para decisão de criar rota própria depois.
  const [mpRes, pagbankRes] = orgOwnerId
    ? await Promise.all([
        apiFetchServer('/api/mp/status'),
        apiFetchServer('/api/pagbank/status'),
      ])
    : [null, null]
  const contaMp = mpRes?.ok ? await mpRes.json() as { connected: boolean } : { connected: false }
  const contaPagBank = pagbankRes?.ok ? await pagbankRes.json() as { connected: boolean } : { connected: false }

  // Locais que o usuário já usou em outros eventos — sugestão imediata ao
  // começar a preencher o local, sem precisar digitar nada
  const locaisRes = await apiFetchServer(`/api/eventos/locais-recentes?excluirId=${id}`)
  const { locaisRecentes } = locaisRes.ok
    ? await locaisRes.json() as { locaisRecentes: {
        id: string; name: string; city: string | null; state: string | null
        zipCode: string | null; street: string | null; streetNumber: string | null
        neighborhood: string | null; complement: string | null
        lat: number | null; lng: number | null; capacity: number | null
        hasParking: boolean | null; parkingSpots: number | null
      }[] }
    : { locaisRecentes: [] }

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-12">

        {/* ── Capa do evento ─────────────────────────────────────────────────── */}
        {(evento as unknown as { banner_url: string | null }).banner_url ? (
          <div className="relative w-full rounded-2xl overflow-hidden mb-8 group" style={{ aspectRatio: '780/420' }}>
            <img
              src={(evento as unknown as { banner_url: string }).banner_url}
              alt={evento.title ?? 'Banner do evento'}
              className="w-full h-full object-cover"
            />
            {/* Overlay gradiente com título */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
              <div>
                <p className="text-white text-xs font-medium uppercase tracking-widest opacity-60 mb-1"
                   style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {evento.category ?? 'Evento'}
                </p>
                <h1 className="text-white text-xl font-semibold leading-tight"
                    style={{ fontFamily: 'var(--font-outfit)' }}>
                  {evento.title ?? 'Novo evento'}
                </h1>
              </div>
              <a
                href={`/criar-evento/${id}/imagens`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium opacity-0 group-hover:opacity-100 transition-all"
                style={{ background: 'rgba(0,0,0,0.6)', color: '#E8B84B', border: '1px solid rgba(232,184,75,0.3)', fontFamily: 'var(--font-dm-sans)', backdropFilter: 'blur(4px)' }}
              >
                <ImagePlus size={12} /> Trocar foto
              </a>
            </div>
          </div>
        ) : (
          <a
            href={`/criar-evento/${id}/imagens`}
            className="flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed border-[#1e1e1e] hover:border-[#E8B84B]/30 hover:bg-[#E8B84B]/3 transition-all mb-8 py-10 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#111] border border-[#1c1c1c] flex items-center justify-center group-hover:border-[#E8B84B]/30 transition-colors">
              <ImagePlus size={20} className="text-[#333] group-hover:text-[#E8B84B]/60 transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-[#555] text-sm font-medium group-hover:text-[#888] transition-colors"
                 style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {evento.title ?? 'Novo evento'}
              </p>
              <p className="text-[#333] text-xs mt-0.5 group-hover:text-[#444] transition-colors"
                 style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Clique para adicionar a foto do evento
              </p>
            </div>
          </a>
        )}

        {/* Banner de rascunho */}
        <div className="flex items-center gap-2.5 bg-[#E8B84B]/8 border border-[#E8B84B]/20 rounded-xl px-4 py-3 mb-8">
          <FileEdit size={14} className="text-[#E8B84B] shrink-0" />
          <p className="text-[#E8B84B] text-xs font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Rascunho — preencha os detalhes e publique quando estiver pronto.
          </p>
        </div>

        <EventoForm
          eventoId={evento.id}
          herdaDadosDoPai={!!evento.parent_event_id && (!!evento.modulo_tenda || !!evento.modulo_estacionamento)}
          isChild={!!evento.parent_event_id}
          parentEventId={evento.parent_event_id ?? null}
          permitirVendaNoCaixaPaiInicial={(evento as unknown as { permitir_venda_no_caixa_pai: boolean | null }).permitir_venda_no_caixa_pai ?? true}
          tipoPessoa={tipoPessoa}
          perfilCidade={profile?.city  ?? null}
          perfilEstado={profile?.state ?? null}
          locaisRecentes={locaisRecentes}
          mpConectado={contaMp.connected}
          pagbankConectado={contaPagBank.connected}
          responsavel={tipoPessoa === 'pf' ? {
            nome:     profile?.full_name ?? '',
            cpf:      profile?.cpf       ?? '',
            telefone: profile?.phone     ?? '',
            email:    user.email         ?? '',
          } : null}
          inicial={{
            titulo:        evento.title         ?? '',
            descricao:     evento.description   ?? '',
            categoria:     evento.category      ?? '',
            dataInicio:    evento.date_start     ?? '',
            dataFim:       evento.date_end       ?? '',
            nomeLocal:     evento.venue_name     ?? '',
            venueId:       (evento as unknown as { venue_id: string | null }).venue_id ?? null,
            cep:           evento.zip_code       ?? '',
            rua:           evento.street         ?? '',
            numero:        evento.street_number  ?? '',
            bairro:        evento.neighborhood   ?? '',
            cidade:        evento.city           ?? '',
            estado:        evento.state          ?? '',
            complemento:   evento.complement     ?? '',
            capacidade:    (evento as unknown as { capacity: number | null }).capacity?.toString() ?? '',
            feeMode:       ((evento as unknown as { fee_mode: string | null }).fee_mode ?? 'promotor') as 'promotor' | 'comprador' | 'mista',
            paymentGateway: ((evento as unknown as { payment_gateway: string | null }).payment_gateway ?? 'mercadopago') as 'mercadopago' | 'pagbank',
            lat:           (evento as unknown as { lat: number | null }).lat ?? null,
            lng:           (evento as unknown as { lng: number | null }).lng ?? null,
          }}
        />

        <MPConnect />

      </main>
    </div>
  )
}
