// Página de perfil do usuário — busca dados do banco e exibe formulário editável
// Rota protegida: o proxy redireciona para /auth se não estiver logado
import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { Header }        from '@/components/layout/Header'
import { ProfileForm }   from './ProfileForm'
import { CodigoOrg }     from './CodigoOrg'
import { AlertCircle }   from 'lucide-react'

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
      city, state, address_type, complement, created_at
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

  // Busca todas as organizações do usuário (pode ter promotora + estabelecimento)
  const { data: orgsData } = await supabase
    .from('organizations')
    .select('codigo, type, name')
    .eq('owner_id', user.id)
    .not('codigo', 'is', null)
  const orgs = orgsData ?? []
  const org = orgs[0] ?? null

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
        {camposFaltando.length > 0 && (
          <div className="flex items-start gap-3 bg-red-500/8 border border-red-500/20 rounded-2xl px-5 py-4 mb-6">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 text-sm font-medium mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Complete seu perfil para aproveitar todos os recursos
              </p>
              <p className="text-red-400/60 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Faltam: {camposFaltando.join(', ')}
              </p>
            </div>
          </div>
        )}

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

        {/* Badges de identificação — exibe um badge por organização (promotora e/ou estabelecimento) */}
        {orgs.map(o => (
          <CodigoOrg
            key={o.codigo}
            codigo={o.codigo!}
            tipo={o.type as 'promotora' | 'estabelecimento'}
            nome={o.name ?? ''}
          />
        ))}

        {/* Formulário editável — client component com foto, dados e endereço */}
        <ProfileForm
          userId={user.id}
          initial={{
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
        />

      </main>
    </div>
  )
}
