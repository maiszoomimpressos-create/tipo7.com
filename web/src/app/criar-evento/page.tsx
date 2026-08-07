// Página de criação de evento
// Fluxo: perfil 100% completo → modal (nicho + nome do evento) → formulário de evento.
// CNPJ é opcional e fica em /perfil (aba "Dados de promotor"), não aqui.
import { getAuthUser }  from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect }     from 'next/navigation'
import { Header }       from '@/components/layout/Header'
import { PromoterLayout } from '@/components/layout/PromoterLayout'
import { CriarEventoClient } from './CriarEventoClient'
import { CompletarCadastroForm } from './CompletarCadastroForm'

const CAMPOS_OBRIGATORIOS = [
  { campo: 'full_name'     as const, label: 'Nome completo'      },
  { campo: 'phone'         as const, label: 'Telefone'           },
  { campo: 'cpf'           as const, label: 'CPF'                },
  { campo: 'birth_date'    as const, label: 'Data de nascimento' },
  { campo: 'zip_code'      as const, label: 'CEP'                },
  { campo: 'street'        as const, label: 'Rua'                },
  { campo: 'street_number' as const, label: 'Número'             },
  { campo: 'neighborhood'  as const, label: 'Bairro'             },
  { campo: 'city'          as const, label: 'Cidade'             },
  { campo: 'state'         as const, label: 'Estado'             },
  { campo: 'address_type'  as const, label: 'Tipo de residência' },
]

interface OrgApi {
  id: string; name: string; type: string; cnpj: string | null; nomeFantasia: string | null
  role: string; status: 'ativo' | 'convidado'
}

interface EventoApi {
  id: string; title: string | null; status: string; date_start: string | null; created_at: string
  banner_url: string | null; modulo_ingressos: boolean; modulo_estacionamento: boolean
}

export default async function CriarEventoPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/criar-evento')

  const profileRes = await apiFetchServer('/api/profile')
  const profile = profileRes.ok ? await profileRes.json() as {
    full_name: string | null; phone: string | null; cpf: string | null; birth_date: string | null
    zip_code: string | null; street: string | null; street_number: string | null
    neighborhood: string | null; city: string | null; state: string | null
    address_type: string | null; complement: string | null
  } : null

  const faltando       = CAMPOS_OBRIGATORIOS.filter(({ campo }) => !profile?.[campo as keyof typeof profile])
  const perfilCompleto = faltando.length === 0

  const promotorRes = await apiFetchServer('/api/profile/promotor')
  const promotorProfile = promotorRes.ok ? await promotorRes.json() as { id: string } | null : null

  // Busca todas as organizações que o usuário administra — dono integral,
  // sócio, mas só as ativas (convite pendente não conta pra criar evento
  // ainda). Pode ser mais de uma agora (ex: várias casas de show com CNPJ
  // próprio) — nesse caso o modal pergunta qual delas está criando o
  // evento, em vez de adivinhar. Inclui eventuais linhas legadas de
  // type='estabelecimento' (não são mais criadas, mas ainda têm eventos
  // reais atrelados, então continuam entrando na listagem "Meus eventos").
  const orgsRes = await apiFetchServer('/api/organizations')
  const { organizacoes: orgsRaw } = orgsRes.ok
    ? await orgsRes.json() as { organizacoes: OrgApi[] }
    : { organizacoes: [] as OrgApi[] }

  const orgs = orgsRaw.filter(o => o.status === 'ativo')
  const orgIds = orgs.map(o => o.id)
  // Só entram no seletor do modal as organizações type='promotora' (as
  // legadas type='estabelecimento' seguem existindo só por causa de
  // eventos antigos, não criam evento novo).
  const organizacoesPromotoras = orgs.filter(o => o.type === 'promotora')

  const eventosRes = orgIds.length > 0 ? await apiFetchServer('/api/eventos/meus') : null
  const { eventos } = eventosRes?.ok
    ? await eventosRes.json() as { eventos: EventoApi[] }
    : { eventos: [] as EventoApi[] }

  const temOrg = orgIds.length > 0

  const conteudo = (
    <main className="max-w-2xl mx-auto px-4 py-16">

      {/* ── Perfil incompleto — formulário inline ── */}
      {!perfilCompleto && (
        <CompletarCadastroForm
          profile={{
            full_name:     profile?.full_name     ?? null,
            phone:         profile?.phone         ?? null,
            cpf:           profile?.cpf           ?? null,
            birth_date:    profile?.birth_date    ?? null,
            zip_code:      profile?.zip_code      ?? null,
            street:        profile?.street        ?? null,
            street_number: profile?.street_number ?? null,
            neighborhood:  profile?.neighborhood  ?? null,
            city:          profile?.city          ?? null,
            state:         profile?.state         ?? null,
            address_type:  profile?.address_type  ?? null,
          }}
          faltando={faltando}
          todos={CAMPOS_OBRIGATORIOS}
        />
      )}

      {/* ── Perfil completo — botão + modal + eventos ── */}
      {perfilCompleto && (
        <CriarEventoClient
          promotorId={promotorProfile?.id ?? null}
          nomeUsuario={profile?.full_name ?? 'Promotor'}
          organizacoes={organizacoesPromotoras.map(o => ({
            id:            o.id,
            name:          o.name,
            type:          o.type as 'promotora' | 'estabelecimento',
            cnpj:          o.cnpj ?? null,
            nome_fantasia: o.nomeFantasia ?? null,
          }))}
          profile={{
            phone:         profile?.phone         ?? '',
            zip_code:      profile?.zip_code      ?? '',
            street:        profile?.street        ?? '',
            street_number: profile?.street_number ?? '',
            neighborhood:  profile?.neighborhood  ?? '',
            city:          profile?.city          ?? '',
            state:         profile?.state         ?? '',
            complement:    profile?.complement    ?? '',
          }}
          eventos={eventos.map(e => ({
            id:                    e.id,
            title:                 e.title ?? 'Novo evento',
            status:                e.status as 'rascunho' | 'publicado',
            date_start:            e.date_start,
            created_at:            e.created_at,
            banner_url:            e.banner_url,
            modulo_ingressos:      e.modulo_ingressos,
            modulo_estacionamento: e.modulo_estacionamento,
          }))}
        />
      )}

    </main>
  )

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col">
      <Header />
      {temOrg ? (
        <PromoterLayout>{conteudo}</PromoterLayout>
      ) : (
        conteudo
      )}
    </div>
  )
}
