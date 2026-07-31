// Organizações que o usuário administra — proprietário integral ou sócio,
// uma ou várias (ex: a mesma marca de casa de show com CNPJ próprio em
// cada cidade). Movido pra dentro de "Configurar" no sidebar do promotor
// (antes só existia escondido dentro de /perfil) — é aqui que quem
// trabalha no dia a dia (/minha-area, /criar-evento) espera encontrar.
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { Header }         from '@/components/layout/Header'
import { PromoterLayout } from '@/components/layout/PromoterLayout'
import { PromotorForm, type OrganizacaoItem } from '@/app/perfil/PromotorForm'

export default async function OrganizacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/configuracoes/organizacoes')

  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', user.id).single()

  const admin = createServiceClient()
  const { data: orgAdminRows } = await admin
    .from('organization_admins')
    .select(`
      role, participacao, percentual, status,
      organizations (id, codigo, name, cnpj, nome_fantasia, logo_url,
        city, state, street, street_number, neighborhood, zip_code, complement, phone, nicho, capacity)
    `)
    .eq('user_id', user.id)
    .neq('status', 'removido')
    .order('created_at')

  const organizacoes: OrganizacaoItem[] = (orgAdminRows ?? []).flatMap(r => {
    const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations
    if (!org) return []
    return [{
      ...org,
      role:         r.role as string,
      participacao: r.participacao as 'integral' | 'socio',
      percentual:   r.percentual as number | null,
      status:       r.status as 'ativo' | 'convidado',
    }]
  })

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col">
      <Header />
      <PromoterLayout>
        <main className="max-w-2xl mx-auto px-4 py-12 w-full">

          <div className="mb-8">
            <h1
              className="text-2xl text-white mb-1"
              style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}
            >
              Organizações
            </h1>
            <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Empresas e casas de show que você administra — cada uma com seu próprio CNPJ, se tiver.
            </p>
          </div>

          <PromotorForm nomeUsuario={profile?.full_name ?? 'Promotor'} initialOrganizacoes={organizacoes} />

        </main>
      </PromoterLayout>
    </div>
  )
}
