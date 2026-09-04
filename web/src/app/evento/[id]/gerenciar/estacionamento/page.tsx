import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

// Consolidado (03/09/2026, pedido do usuário) dentro do wizard único
// "Locais e Caixas" — ver /evento/[id]/gerenciar/locais/LocaisWizard.tsx.
// Redirect em vez de apagar a rota, pra não quebrar link/favorito antigo.
export default async function GerenciarEstacionamentoPage({ params }: Props) {
  const { id } = await params
  redirect(`/evento/${id}/gerenciar/locais`)
}
