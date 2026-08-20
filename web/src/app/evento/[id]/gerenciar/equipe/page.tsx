import { PainelEquipe } from '../../PainelEquipe'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GerenciarEquipePage({ params }: Props) {
  const { id } = await params
  return (
    <div className="p-6 max-w-3xl">
      <PainelEquipe eventoId={id} />
    </div>
  )
}
