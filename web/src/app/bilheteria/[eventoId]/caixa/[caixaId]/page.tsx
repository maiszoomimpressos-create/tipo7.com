import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect } from 'next/navigation'
import { ShieldX } from 'lucide-react'
import { BilheteiroClient } from '../../BilheteiroClient'

interface Props {
  params: Promise<{ eventoId: string; caixaId: string }>
}

interface CaixaBootstrap {
  id: string
  nome: string
  eventoId: string
  isOwner: boolean
  // null quando o caixa não controla ingresso físico (pulseira) — ver
  // controlaIngressosFisicos no backend (caixas.service.ts).
  saldoIngressos: number | null
  controlaIngressosFisicos: boolean
  evento: { id: string; title: string | null; dateStart: string | null; venueName: string | null; city: string | null; state: string | null }
  ingressos: Array<{ id: string; name: string; price: number; disponivel: number; eventoId: string; eventoTitle: string }>
  operadorName: string
}

export default async function CaixaPage({ params }: Props) {
  const { eventoId, caixaId } = await params

  const user = await getAuthUser()
  if (!user) redirect(`/auth?next=/bilheteria/${eventoId}/caixa/${caixaId}`)

  const res = await apiFetchServer(`/api/caixas/${caixaId}/bootstrap`)

  if (!res.ok) {
    // O backend já lança a mensagem certa pra cada caso (caixa não
    // encontrado / já fechado / fechamento pendente / sem permissão) —
    // repassa direto, preserva as mesmas 4 mensagens da página original.
    const body = await res.json().catch(() => null) as { message?: string } | null
    return <SemPermissao mensagem={body?.message ?? 'Não foi possível carregar este caixa.'} />
  }

  const caixa: CaixaBootstrap = await res.json()

  if (caixa.eventoId !== eventoId) {
    return <SemPermissao mensagem="Caixa não encontrado." />
  }

  return (
    <BilheteiroClient
      eventoId={eventoId}
      caixaId={caixaId}
      caixaNome={caixa.nome}
      saldoIngressos={caixa.saldoIngressos}
      controlaIngressosFisicos={caixa.controlaIngressosFisicos}
      isOwner={caixa.isOwner}
      eventoTitle={caixa.evento.title ?? 'Evento'}
      eventoDate={caixa.evento.dateStart ?? null}
      eventoLocal={[caixa.evento.venueName, caixa.evento.city, caixa.evento.state].filter(Boolean).join(' — ')}
      ingressos={caixa.ingressos}
      operadorName={caixa.operadorName}
    />
  )
}

function SemPermissao({ mensagem }: { mensagem: string }) {
  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
           style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
        <ShieldX size={28} className="text-red-400" />
      </div>
      <h1 className="text-white text-xl font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
        Acesso negado
      </h1>
      <p className="text-[#555] text-sm max-w-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        {mensagem}
      </p>
      <a href="/" className="mt-2 text-sm hover:underline" style={{ color: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
        Voltar ao início
      </a>
    </div>
  )
}
