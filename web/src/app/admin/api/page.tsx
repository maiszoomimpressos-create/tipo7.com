import { getAuthUser } from '@/lib/auth/server'
import { getAdminMember, temAcessoRestrito } from '@/lib/adminAuth'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect } from 'next/navigation'
import { Webhook } from 'lucide-react'
import { IntegracoesAccordion } from './IntegracoesAccordion'
import { AreaRestritaWatcher } from '@/app/admin/area-restrita/AreaRestritaWatcher'

export default async function ApiPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth')

  const me = await getAdminMember(user.id)
  if (!me || !temAcessoRestrito(me)) redirect('/admin')
  const statusRes = await apiFetchServer('/api/admin/area-restrita/status')
  const { desbloqueada } = statusRes.ok ? await statusRes.json() as { desbloqueada: boolean } : { desbloqueada: false }
  if (!desbloqueada) redirect(`/admin/area-restrita?next=${encodeURIComponent('/admin/api')}`)

  // GET /admin/integracoes já devolve as rotas aninhadas dentro de cada
  // integração (o backend já faz o agrupamento que essa página fazia
  // manualmente) — Fase 7.2, G15.
  const res = await apiFetchServer('/api/admin/integracoes')
  const { integracoes: dados } = res.ok
    ? await res.json() as { integracoes: unknown[] }
    : { integracoes: [] as unknown[] }

  return (
    <div className="p-8 max-w-4xl">
      <AreaRestritaWatcher currentPath="/admin/api" />
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold flex items-center gap-2.5" style={{ fontFamily: 'var(--font-outfit)' }}>
          <Webhook size={22} className="text-[#E8B84B]" />
          API
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Integrações da plataforma com sistemas externos
        </p>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <IntegracoesAccordion integracoes={dados as any} />

    </div>
  )
}
