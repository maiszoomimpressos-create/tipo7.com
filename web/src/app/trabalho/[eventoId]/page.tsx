import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect } from 'next/navigation'
import { ShieldX } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { TrabalhoClient } from './TrabalhoClient'

interface Props {
  params: Promise<{ eventoId: string }>
}

interface MeuAcesso {
  evento: {
    id: string; title: string | null; dateStart: string | null
    venueName: string | null; city: string | null; state: string | null; bannerUrl: string | null
  } | null
  isOwner: boolean
  staff: { id: string; positionName: string | null; permissions: string[]; token: string | null; pinDefinido: boolean } | null
}

interface IngressoResumo {
  id: string; name: string; price: number; total: number; vendidos: number; disponivel: number
}

const PERMISSOES_DONO = [
  'validar_ingresso', 'vender_ingresso', 'ver_lista_convidados', 'ver_relatorios',
  'gerenciar_checkin', 'gerenciar_equipe', 'estacionamento_entrada', 'estacionamento_saida',
]

export default async function TrabalhoPage({ params }: Props) {
  const { eventoId } = await params

  const user = await getAuthUser()
  if (!user) redirect(`/auth?next=/trabalho/${eventoId}`)

  const [acessoRes, caixaRes, ingressosRes] = await Promise.all([
    apiFetchServer(`/api/eventos/${eventoId}/meu-acesso`),
    apiFetchServer(`/api/eventos/${eventoId}/meu-caixa`),
    apiFetchServer(`/api/eventos/${eventoId}/ingressos-resumo`),
  ])

  const acesso: MeuAcesso = acessoRes.ok
    ? await acessoRes.json()
    : { evento: null, isOwner: false, staff: null }

  if (!acesso.evento) return <SemAcesso mensagem="Evento não encontrado." />

  if (!acesso.isOwner && !acesso.staff) {
    return <SemAcesso mensagem="Você não faz parte da equipe deste evento." />
  }

  const permissoes = acesso.isOwner ? PERMISSOES_DONO : (acesso.staff?.permissions ?? [])

  const caixaDesignado = caixaRes.ok
    ? await caixaRes.json() as { id: string; nome: string; estacionamentoId: string | null } | null
    : null
  const { ingressos } = ingressosRes.ok
    ? await ingressosRes.json() as { ingressos: IngressoResumo[] }
    : { ingressos: [] as IngressoResumo[] }

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />
      <TrabalhoClient
        eventoId={eventoId}
        eventoTitle={acesso.evento.title ?? 'Evento'}
        eventoDate={acesso.evento.dateStart ?? null}
        eventoLocal={[acesso.evento.venueName, acesso.evento.city, acesso.evento.state].filter(Boolean).join(' — ')}
        eventoBanner={acesso.evento.bannerUrl ?? null}
        cargoNome={acesso.isOwner ? 'Organizador' : (acesso.staff?.positionName ?? 'Equipe')}
        permissoes={permissoes}
        ingressos={ingressos}
        isOwner={acesso.isOwner}
        caixaDesignado={caixaDesignado ? { id: caixaDesignado.id, nome: caixaDesignado.nome, estacionamentoId: caixaDesignado.estacionamentoId } : null}
        acessoCaixa={acesso.staff ? { staffId: acesso.staff.id, token: acesso.staff.token, pinDefinido: acesso.staff.pinDefinido } : null}
      />
    </div>
  )
}

function SemAcesso({ mensagem }: { mensagem: string }) {
  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col items-center justify-center px-6 text-center gap-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}
      >
        <ShieldX size={28} className="text-red-400" />
      </div>
      <h1 className="text-white text-xl font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
        Acesso negado
      </h1>
      <p className="text-[#555] text-sm max-w-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        {mensagem}
      </p>
      <a href="/trabalhos" className="mt-2 text-sm text-[#E8B84B] hover:underline" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        Voltar aos trabalhos
      </a>
    </div>
  )
}
