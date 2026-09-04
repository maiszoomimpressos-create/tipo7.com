import { apiFetchServer } from '@/lib/apiFetchServer'
import { notFound } from 'next/navigation'
import { LocaisWizard } from './LocaisWizard'

interface Props {
  params: Promise<{ id: string }>
}

// Wizard único de Locais e Caixas (03/09/2026, pedido do usuário) —
// substitui as telas separadas de Estacionamento/Bilheteria por um fluxo
// sequencial: Estacionamento → Bilheteria → Tenda, cada um perguntando
// "nome + quantos caixas". Ver LocaisWizard.tsx.
export default async function GerenciarLocaisPage({ params }: Props) {
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
      <LocaisWizard
        eventoId={id}
        eventoTitle={acesso.evento?.title ?? 'Evento'}
        moduloEstacionamentoInicial={evento.modulo_estacionamento ?? false}
      />
    </div>
  )
}
