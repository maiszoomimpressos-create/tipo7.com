import { PainelAtributos } from '../../PainelAtributos'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GerenciarEstruturaPage({ params }: Props) {
  const { id } = await params
  return (
    <div className="p-6 max-w-3xl">
      <PainelAtributos eventoId={id} />
    </div>
  )
}
