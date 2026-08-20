import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GerenciarIndexPage({ params }: Props) {
  const { id } = await params
  redirect(`/evento/${id}/gerenciar/ingressos`)
}
