// Painel de colaboradores — visível pra qualquer sócio/proprietário de
// uma organização, mostra os pedidos de equipe mandados pra eventos de
// TODAS as organizações que o usuário administra (não só uma). Só leitura
// aqui — convidar/gerenciar continua na tela de Equipe de cada evento; a
// própria pessoa convidada aceita/recusa em /trabalhos.
import { getAuthUser }    from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect }       from 'next/navigation'
import { Header }         from '@/components/layout/Header'
import { PromoterLayout } from '@/components/layout/PromoterLayout'
import { ColaboradoresClient, type ColaboradorRow } from './ColaboradoresClient'

export default async function ColaboradoresPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/configuracoes/colaboradores')

  // GET /organizations/colaboradores já devolve exatamente o shape que essa
  // página montava manualmente (mesma lógica de abas por data, mesmo join
  // event_staff → events → profiles) — troca mecânica, sem rota nova.
  const res = await apiFetchServer('/api/organizations/colaboradores')
  const { linhas } = res.ok
    ? await res.json() as { linhas: ColaboradorRow[] }
    : { linhas: [] as ColaboradorRow[] }

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col">
      <Header />
      <PromoterLayout>
        <main className="max-w-4xl mx-auto px-4 py-12 w-full">

          <div className="mb-8">
            <h1
              className="text-2xl text-white mb-1"
              style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}
            >
              Colaboradores
            </h1>
            <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Pedidos de equipe mandados pra eventos das organizações que você administra.
            </p>
          </div>

          <ColaboradoresClient linhas={linhas} />

        </main>
      </PromoterLayout>
    </div>
  )
}
