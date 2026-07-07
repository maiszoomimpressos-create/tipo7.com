// Página de criação de evento
// Fluxo: perfil 100% completo → modal PF/PJ (1x, editável) → formulário de evento
import { createClient } from '@/lib/supabase/server'
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

export default async function CriarEventoPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/criar-evento')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, cpf, birth_date, zip_code, street, street_number, neighborhood, city, state, address_type, complement')
    .eq('id', user.id)
    .single()

  const faltando       = CAMPOS_OBRIGATORIOS.filter(({ campo }) => !profile?.[campo as keyof typeof profile])
  const perfilCompleto = faltando.length === 0

  const { data: promotorProfile } = await supabase
    .from('promotor_profiles')
    .select('id, tipo_pessoa')
    .eq('user_id', user.id)
    .single()

  // Busca todas as organizações do usuário (pode ter promotora + estabelecimento)
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)

  const orgIds = (orgs ?? []).map(o => o.id)

  const { data: eventos } = orgIds.length > 0
    ? await supabase
        .from('events')
        .select('id, title, status, date_start, created_at, banner_url')
        .in('organization_id', orgIds)
        .order('created_at', { ascending: false })
    : { data: [] }

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
          tipoPessoaAtual={(promotorProfile?.tipo_pessoa ?? null) as 'pf' | 'pj' | null}
          nomeUsuario={profile?.full_name ?? 'Promotor'}
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
          eventos={(eventos ?? []).map(e => ({
            id:         e.id,
            title:      e.title ?? 'Novo evento',
            status:     e.status as 'rascunho' | 'publicado',
            date_start: e.date_start ?? null,
            created_at: e.created_at,
            banner_url: (e as unknown as { banner_url: string | null }).banner_url ?? null,
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
