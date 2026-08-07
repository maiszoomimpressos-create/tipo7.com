import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PromoterLayout } from '@/components/layout/PromoterLayout'
import { DashboardClient } from './DashboardClient'
import type { Comprador, EventoResumo, TipoIngresso } from './DashboardClient'

interface DashboardApi {
  semOrganizacao?: true
  orgName: string
  orgCodigo: string | null
  orgTipo: 'promotora' | 'estabelecimento' | null
  eventos: EventoResumo[]
  kpis: { receita: number; vendidos: number; checkins: number; totalEventos: number }
  tiposIngresso: TipoIngresso[]
  compradores: Comprador[]
}

export default async function MinhaAreaPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/minha-area')

  // GET /minha-area/dashboard já monta o mesmo agregado (org + eventos +
  // KPIs + compradores) que essa página montava manualmente via várias
  // queries diretas (Fase 7.2, G11).
  const res = await apiFetchServer('/api/minha-area/dashboard')
  if (!res.ok) redirect('/criar-evento')

  const data: DashboardApi = await res.json()
  if (data.semOrganizacao) redirect('/criar-evento')

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col">
      <Header />
      <PromoterLayout>
        <main className="flex-1">
          <DashboardClient
            orgName={data.orgName}
            orgCodigo={data.orgCodigo}
            orgTipo={data.orgTipo}
            eventos={data.eventos}
            kpis={data.kpis}
            tiposIngresso={data.tiposIngresso}
            compradores={data.compradores}
          />
        </main>
        <Footer />
      </PromoterLayout>
    </div>
  )
}
