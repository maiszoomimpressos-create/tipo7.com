import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect } from 'next/navigation'
import { ShieldX } from 'lucide-react'
import { GerenciadorCaixas } from './GerenciadorCaixas'
import { AtualizarButton } from './AtualizarButton'

interface Props {
  params: Promise<{ eventoId: string }>
}

interface MeuAcesso {
  evento: {
    id: string; title: string | null; dateStart: string | null
    venueName: string | null; city: string | null; state: string | null
  } | null
  isOwner: boolean
  staff: { permissions: string[] } | null
}

export default async function BilheteriaPage({ params }: Props) {
  const { eventoId } = await params

  const user = await getAuthUser()
  if (!user) redirect(`/auth?next=/bilheteria/${eventoId}`)

  const acessoRes = await apiFetchServer(`/api/eventos/${eventoId}/meu-acesso`)
  const acesso: MeuAcesso = acessoRes.ok
    ? await acessoRes.json()
    : { evento: null, isOwner: false, staff: null }

  if (!acesso.evento) return <SemPermissao mensagem="Evento não encontrado." />

  // Dono do evento: painel de gerenciamento de caixas
  if (acesso.isOwner) {
    return (
      <GerenciadorCaixas
        eventoId={eventoId}
        eventoTitle={acesso.evento.title ?? 'Evento'}
        eventoDate={acesso.evento.dateStart}
        eventoLocal={[acesso.evento.venueName, acesso.evento.city, acesso.evento.state].filter(Boolean).join(' — ')}
        userId={user.id}
      />
    )
  }

  // Operadores com permissão vender_ingresso são redirecionados ao caixa designado
  const isVendedor = (acesso.staff?.permissions ?? []).includes('vender_ingresso')

  if (isVendedor) {
    const caixaRes = await apiFetchServer(`/api/eventos/${eventoId}/meu-caixa`)
    const caixa = caixaRes.ok ? await caixaRes.json() as { id: string; nome: string } | null : null

    if (caixa) redirect(`/bilheteria/${eventoId}/caixa/${caixa.id}`)

    // Sem caixa designado: mostra mensagem de espera
    return (
      <div className="min-h-dvh bg-[#070707] flex flex-col items-center justify-center px-6 text-center gap-4">
        <h1 className="text-white text-xl font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Aguardando abertura do caixa
        </h1>
        <p className="text-[#555] text-sm max-w-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          O promotor ainda não abriu e designou um caixa para você. Atualize a página em instantes.
        </p>
        <AtualizarButton />
      </div>
    )
  }

  return <SemPermissao mensagem="Você não tem permissão para acessar a bilheteria deste evento." />
}

// Mesmo achado de segurança das outras 2 telas "Acesso negado" (ver
// bilheteria/[eventoId]/caixa/[caixaId]/page.tsx e
// estacionamento/[eventoId]/page.tsx) — sem link pra home pública.
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
    </div>
  )
}
