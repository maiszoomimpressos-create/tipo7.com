// Página de perfil do usuário — busca dados do banco e exibe formulário editável
// Rota protegida: o proxy redireciona para /auth se não estiver logado
import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect }      from 'next/navigation'
import { Header }        from '@/components/layout/Header'
import { CodigoOrg }     from './CodigoOrg'
import { PerfilBanner }  from './PerfilBanner'
import { PerfilTabs }    from './PerfilTabs'

export default async function PerfilPage() {
  // Busca o usuário logado (garantido pelo proxy, mas verificamos por segurança)
  const user = await getAuthUser()
  if (!user) redirect('/auth')

  // Busca o perfil completo — inclui endereço e avatar
  const profileRes = await apiFetchServer('/api/profile')
  const profile = profileRes.ok ? await profileRes.json() as {
    full_name: string | null; phone: string | null; cpf: string | null; rg: string | null
    birth_date: string | null; avatar_url: string | null
    zip_code: string | null; street: string | null; street_number: string | null
    neighborhood: string | null; city: string | null; state: string | null
    address_type: string | null; complement: string | null
    created_at: string | null; user_code: string | null
  } : null

  // Formata datas no padrão brasileiro para exibição
  const formatarData = (iso: string | null | undefined) => {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  }

  const dataCadastro  = formatarData(profile?.created_at)
  // last_sign_in_at não existe mais (era campo do Supabase Auth) — Fase 6
  // não trackeia último acesso ainda, então essa info fica oculta por ora.
  const ultimoAcesso  = null as string | null

  // Calcula campos faltando para exibir banner de aviso
  const camposFaltando = [
    !profile?.full_name     && 'Nome completo',
    !profile?.phone         && 'Telefone',
    !profile?.cpf           && 'CPF',
    !profile?.birth_date    && 'Data de nascimento',
    !profile?.zip_code      && 'CEP',
    !profile?.street        && 'Rua',
    !profile?.street_number && 'Número do endereço',
    !profile?.neighborhood  && 'Bairro',
    !profile?.address_type  && 'Tipo de residência',
  ].filter(Boolean) as string[]

  // Busca todas as organizações que o usuário administra — dono integral,
  // sócio, ou convite pendente (organization_admins é a fonte única desde
  // que passamos a permitir mais de uma organização por pessoa, ex: a
  // mesma marca "Caldeirão" com CNPJ próprio em cada cidade). GET /organizations
  // já resolve isso (inclusive convite pendente) do lado do NestJS.
  const orgsRes = await apiFetchServer('/api/organizations')
  const { organizacoes: orgsRaw } = orgsRes.ok
    ? await orgsRes.json() as { organizacoes: Array<{
        id: string; codigo: string | null; name: string; cnpj: string | null
        nomeFantasia: string | null; logoUrl: string | null
        city: string | null; state: string | null; street: string | null
        streetNumber: string | null; neighborhood: string | null; zipCode: string | null
        complement: string | null; phone: string | null; nicho: string | null; capacity: number | null
        role: string; participacao: 'integral' | 'socio'; percentual: number | null
        status: 'ativo' | 'convidado'
      }> }
    : { organizacoes: [] }

  // Remapeia camelCase (Prisma) pra snake_case (shape que PerfilTabs/PromotorForm já esperam)
  const organizacoes = orgsRaw.map(org => ({
    id: org.id, codigo: org.codigo, name: org.name, cnpj: org.cnpj,
    nome_fantasia: org.nomeFantasia, logo_url: org.logoUrl,
    city: org.city, state: org.state, street: org.street,
    street_number: org.streetNumber, neighborhood: org.neighborhood, zip_code: org.zipCode,
    complement: org.complement, phone: org.phone, nicho: org.nicho, capacity: org.capacity,
    role: org.role, participacao: org.participacao, percentual: org.percentual, status: org.status,
  }))
  const orgs = organizacoes.filter(o => o.status === 'ativo')

  // Busca os lugares que o usuário administra — "estabelecimento" não é
  // mais uma organização, é um venue com um responsável atribuído.
  const venuesRes = await apiFetchServer('/api/venues/minhas')
  const { venues: venuesRaw } = venuesRes.ok
    ? await venuesRes.json() as { venues: { codigo: string | null; name: string }[] }
    : { venues: [] as { codigo: string | null; name: string }[] }
  const lugaresAdministrados = venuesRaw.filter((v): v is { codigo: string; name: string } => !!v.codigo)

  // Pega a inicial do nome ou email para o avatar placeholder
  const inicialAvatar = (profile?.full_name ?? user.email ?? '?').charAt(0).toUpperCase()

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-12">

        {/* Cabeçalho da página */}
        <div className="mb-8">
          <h1
            className="text-2xl text-white mb-1"
            style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}
          >
            Meu perfil
          </h1>
          <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Mantenha seus dados atualizados para uma melhor experiência na plataforma.
          </p>
        </div>

        {/* Banner de perfil incompleto — exibe quais campos ainda faltam */}
        <PerfilBanner initialFaltando={camposFaltando} />

        {/* Bloco de identificação: avatar + email (não editável) */}
        <div className="flex items-center gap-4 mb-8 p-5 bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl">
          {/* Avatar: exibe foto se existir, senão a inicial em dourado */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-[#070707] shrink-0 overflow-hidden"
            style={{ background: profile?.avatar_url ? 'transparent' : '#E8B84B', fontFamily: 'var(--font-syne)' }}
          >
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt="Foto de perfil"
                className="w-full h-full object-cover"
              />
            ) : (
              inicialAvatar
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {profile?.full_name ?? 'Sem nome'}
            </p>
            <p className="text-[#555] text-sm truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {user.email}
            </p>
            {/* Datas de cadastro e último acesso */}
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2">
              {dataCadastro && (
                <span className="text-[#3a3a3a] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Membro desde {dataCadastro}
                </span>
              )}
              {ultimoAcesso && (
                <span className="text-[#3a3a3a] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Último acesso {ultimoAcesso}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Códigos — coluna esquerda: usuário/promotor (pessoa). Coluna
            direita: estabelecimentos (lugares administrados). */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 mb-2">
          <div>
            <p className="text-[#444] text-[11px] uppercase tracking-wider mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Seus códigos
            </p>
            {profile?.user_code && (
              <CodigoOrg
                codigo={profile.user_code}
                tipo="usuario"
                nome={profile?.full_name ?? user.email ?? ''}
              />
            )}
            {orgs.map(o => (
              <CodigoOrg
                key={o.codigo}
                codigo={o.codigo!}
                tipo="promotora"
                nome={o.name ?? ''}
              />
            ))}
          </div>

          <div>
            <p className="text-[#444] text-[11px] uppercase tracking-wider mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Estabelecimentos
            </p>
            {lugaresAdministrados.length > 0 ? lugaresAdministrados.map(v => (
              <CodigoOrg
                key={v.codigo}
                codigo={v.codigo!}
                tipo="estabelecimento"
                nome={v.name}
              />
            )) : (
              <p className="text-[#333] text-xs italic mb-6" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Você ainda não é responsável por nenhum lugar.
              </p>
            )}
          </div>
        </div>

        {/* Abas: foto sempre visível + Dados pessoais / Dados de promotor / Endereço */}
        <PerfilTabs
          userId={user.id}
          nomeUsuario={profile?.full_name ?? 'Promotor'}
          initialPessoal={{
            // Dados pessoais
            full_name:    profile?.full_name    ?? '',
            phone:        profile?.phone        ?? '',
            cpf:          profile?.cpf          ?? '',
            rg:           (profile as { rg?: string | null })?.rg ?? '',
            birth_date:   profile?.birth_date   ?? '',
            avatar_url:   profile?.avatar_url   ?? '',
            // Endereço
            zip_code:     profile?.zip_code     ?? '',
            street:       profile?.street       ?? '',
            street_number: profile?.street_number ?? '',
            neighborhood: profile?.neighborhood  ?? '',
            city:         profile?.city          ?? '',
            state:        profile?.state         ?? '',
            address_type: profile?.address_type  ?? '',
            complement:   profile?.complement    ?? '',
          }}
          organizacoes={organizacoes}
        />

      </main>
    </div>
  )
}
