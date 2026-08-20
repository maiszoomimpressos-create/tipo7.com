import { ConfiguracoesClient } from './ConfiguracoesClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GerenciarConfiguracoesPage({ params }: Props) {
  const { id } = await params
  return <ConfiguracoesClient eventoId={id} />
}
