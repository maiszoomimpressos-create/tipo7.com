import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { DashboardClient, type DashboardData } from './DashboardClient'

interface Props {
  params: Promise<{ eventoId: string }>
}

export default async function DashboardPage({ params }: Props) {
  const { eventoId } = await params

  const user = await getAuthUser()
  if (!user) redirect(`/auth?next=/dashboard/${eventoId}`)

  const res = await apiFetchServer(`/api/eventos/${eventoId}/dashboard`)

  if (res.status === 404) notFound()
  if (res.status === 403) redirect(`/evento/${eventoId}`)
  if (!res.ok) notFound()

  const data: DashboardData = await res.json()

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />
      <DashboardClient data={data} />
    </div>
  )
}
