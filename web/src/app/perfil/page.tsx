// Página de perfil do usuário — busca dados do banco e exibe formulário editável
// Rota protegida: o proxy redireciona para /auth se não estiver logado
import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { Header }        from '@/components/layout/Header'
import { CodigoOrg }     from './CodigoOrg'
import { PerfilBanner }  from './PerfilBanner'
import { PerfilTabs }    from './PerfilTabs'

export default async function PerfilPage() {
  const supabase = await createClient()

  // Busca o usuário logado (garantido pelo proxy, mas verificamos por segurança)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Busca o perfil completo da tabela profiles — inclui endereço e avatar
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      full_name, phone, cpf, rg, birth_date, avatar_url,
      zip_code, street, street_number, neighborhood,
      city, state, address_type, complement, created_at, user_code
    `)
    .eq('id', user.id)
    .single()

  // Formata datas no padrão brasileiro para exibição
  const formatarData = (iso: string | null | undefined) => {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  }

  const dataCadastro  = formatarData(profile?.created_at)
  const ultimoAcesso  = formatarData(user.last_sign_in_at)

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

  // Busca a organização do usuário. Filtra por type='promotora' — as
  // linhas legadas de type='estabelecimento' já foram espelhadas em
  // venues+venue_admins (ver abaixo) e não devem duplicar o código aqui.
  const { data: orgsData } = await supabase
    .from('organizations')
    .select('id, codigo, type, name, cnpj, nome_fantasia')
    .eq('owner_id', user.id)
    .eq('type', 'promotora')
  const orgs = orgsData ?? []
  const orgPromotora = orgs[0] ?? null

  // Busca os lugares que o usuário administra (venue_admins) — "estabelecimento"
  // não é mais uma organização, é um venue com um responsável atribuído.
  const { data: venueAdminsData } = await supabase
    .from('venue_admins')
    .select('venues ( codigo, name )')
    .eq('user_id', user.id)
    .eq('status', 'ativo')
  const lugaresAdministrados = (venueAdminsData ?? [])
    .map(va => Array.isArray(va.venues) ? va.venues[0] : va.venues)
    .filter((v): v is { codigo: string | null; name: string } => !!v?.codigo)

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
          initialPromotor={{
            orgId:        orgPromotora?.id            ?? null,
            razaoSocial:  orgPromotora?.name           ?? '',
            cnpj:         orgPromotora?.cnpj           ?? '',
            nomeFantasia: orgPromotora?.nome_fantasia  ?? '',
            codigo:       orgPromotora?.codigo         ?? null,
          }}
        />

      </main>
    </div>
  )
}
