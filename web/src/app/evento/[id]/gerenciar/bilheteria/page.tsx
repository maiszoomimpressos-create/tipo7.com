import { apiFetchServer } from '@/lib/apiFetchServer'
import { notFound } from 'next/navigation'
import { GerenciadorBilheterias } from '@/app/bilheteria/[eventoId]/GerenciadorBilheterias'

interface Props {
  params: Promise<{ id: string }>
}

// Locais de bilheteria — pedido do usuário (03/09/2026): mesmo método já
// usado pro Estacionamento (ver /evento/[id]/gerenciar/estacionamento),
// mas sem a etapa de "ativação de módulo": bilheteria não é opcional como
// estacionamento, todo evento vende ingresso.
export default async function GerenciarBilheteriaPage({ params }: Props) {
  const { id } = await params
  const acessoRes = await apiFetchServer(`/api/eventos/${id}/meu-acesso`)
  if (!acessoRes.ok) notFound()
  const acesso = await acessoRes.json() as { evento: { title: string | null } | null }

  return (
    <div className="p-6 max-w-3xl">
      <GerenciadorBilheterias eventoId={id} eventoTitle={acesso.evento?.title ?? 'Evento'} embutido />
    </div>
  )
}
