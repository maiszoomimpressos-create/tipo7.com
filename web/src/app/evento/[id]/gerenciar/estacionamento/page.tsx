import { apiFetchServer } from '@/lib/apiFetchServer'
import { notFound } from 'next/navigation'
import { EstacionamentoAtivacaoClient } from './EstacionamentoAtivacaoClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GerenciarEstacionamentoPage({ params }: Props) {
  const { id } = await params
  const res = await apiFetchServer(`/api/eventos/${id}`)
  if (!res.ok) notFound()
  const evento = await res.json() as { modulo_estacionamento: boolean }

  return (
    <div className="p-6 max-w-3xl">
      <EstacionamentoAtivacaoClient eventoId={id} ativoInicial={evento.modulo_estacionamento ?? false} />
    </div>
  )
}
