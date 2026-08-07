import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { TrabalhosClient } from './TrabalhosClient'

export default async function TrabalhosPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/trabalhos')

  const res = await apiFetchServer('/api/trabalhos')
  const { staff } = res.ok ? await res.json() as { staff: unknown[] } : { staff: [] as unknown[] }

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-2xl text-white mb-1" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
            Trabalhos
          </h1>
          <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Convites de eventos e trabalhos nos quais você está escalado.
          </p>
        </div>

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <TrabalhosClient registros={staff as any} />
      </main>
    </div>
  )
}
