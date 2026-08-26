import { apiFetchServer } from '@/lib/apiFetchServer'
import { notFound } from 'next/navigation'
import { EstacionamentoAtivacaoClient } from './EstacionamentoAtivacaoClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GerenciarEstacionamentoPage({ params }: Props) {
  const { id } = await params
  const [res, acessoRes] = await Promise.all([
    apiFetchServer(`/api/eventos/${id}`),
    apiFetchServer(`/api/eventos/${id}/meu-acesso`),
  ])
  if (!res.ok) notFound()
  const evento = await res.json() as { modulo_estacionamento: boolean }
  const acesso = acessoRes.ok
    ? await acessoRes.json() as { evento: { title: string | null } | null }
    : { evento: null }

  return (
    <div className="p-6 max-w-3xl">
      <EstacionamentoAtivacaoClient
        eventoId={id}
        eventoTitle={acesso.evento?.title ?? 'Evento'}
        ativoInicial={evento.modulo_estacionamento ?? false}
      />
    </div>
  )
}
