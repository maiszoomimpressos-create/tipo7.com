// Organizações que o usuário administra — proprietário integral ou sócio,
// uma ou várias (ex: a mesma marca de casa de show com CNPJ próprio em
// cada cidade). Movido pra dentro de "Configurar" no sidebar do promotor
// (antes só existia escondido dentro de /perfil) — é aqui que quem
// trabalha no dia a dia (/minha-area, /criar-evento) espera encontrar.
import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect }       from 'next/navigation'
import { Header }         from '@/components/layout/Header'
import { PromoterLayout } from '@/components/layout/PromoterLayout'
import { PromotorForm, type OrganizacaoItem } from '@/app/perfil/PromotorForm'

export default async function OrganizacoesPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/configuracoes/organizacoes')

  const profileRes = await apiFetchServer('/api/profile')
  const profile = profileRes.ok ? await profileRes.json() as { full_name: string | null } : null

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

  // Remapeia camelCase (Prisma) pra snake_case (shape que PromotorForm já espera)
  const organizacoes: OrganizacaoItem[] = orgsRaw.map(org => ({
    id: org.id, codigo: org.codigo, name: org.name, cnpj: org.cnpj,
    nome_fantasia: org.nomeFantasia, logo_url: org.logoUrl,
    city: org.city, state: org.state, street: org.street,
    street_number: org.streetNumber, neighborhood: org.neighborhood, zip_code: org.zipCode,
    complement: org.complement, phone: org.phone, nicho: org.nicho, capacity: org.capacity,
    role: org.role, participacao: org.participacao, percentual: org.percentual, status: org.status,
  }))

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
