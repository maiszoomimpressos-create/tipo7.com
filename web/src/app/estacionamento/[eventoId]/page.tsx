import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { redirect } from 'next/navigation'
import { ShieldX } from 'lucide-react'
import { GerenciadorEstacionamentos } from './GerenciadorEstacionamentos'
import { AtendenteClient } from './AtendenteClient'

interface Props {
  params: Promise<{ eventoId: string }>
}

interface MeuAcesso {
  evento: { id: string; title: string | null } | null
  isOwner: boolean
  staff: { portaoId: string | null; permissions: string[] } | null
}

interface EstacionamentoApi {
  id: string
  nome: string
  cobraModo: 'gratis' | 'fixo' | 'por_tempo'
  precoFixo: string | null
  precoPrimeiraHora: string | null
  precoHoraAdicional: string | null
  tetoDiario: string | null
  toleranciaMinutos: number
  controlaSaida: boolean
  vagasTotais: number | null
  estacionamentoPortoes: Array<{ id: string; nome: string; tipo: 'entrada' | 'saida' | 'ambos'; ativo: boolean }>
}

export default async function EstacionamentoPage({ params }: Props) {
  const { eventoId } = await params

  const user = await getAuthUser()
  if (!user) redirect(`/auth?next=/estacionamento/${eventoId}`)

  const acessoRes = await apiFetchServer(`/api/eventos/${eventoId}/meu-acesso`)
  const acesso: MeuAcesso = acessoRes.ok
    ? await acessoRes.json()
    : { evento: null, isOwner: false, staff: null }

  if (!acesso.evento) return <SemPermissao mensagem="Evento não encontrado." />

  if (acesso.isOwner) {
    return <GerenciadorEstacionamentos eventoId={eventoId} eventoTitle={acesso.evento.title ?? 'Evento'} />
  }

  const permissoes = acesso.staff?.permissions ?? []
  const podeEntrada = permissoes.includes('estacionamento_entrada')
  const podeSaida = permissoes.includes('estacionamento_saida')
  const portaoRestrito = acesso.staff?.portaoId ?? null

  if (!podeEntrada && !podeSaida) {
    return <SemPermissao mensagem="Você não tem permissão para acessar o estacionamento deste evento." />
  }

  const [caixaRes, estacionamentosRes] = await Promise.all([
    apiFetchServer(`/api/eventos/${eventoId}/meu-caixa`),
    apiFetchServer(`/api/eventos/${eventoId}/estacionamentos/ativos`),
  ])

  const caixaAberto = caixaRes.ok ? await caixaRes.json() as { id: string; nome: string } | null : null
  const { estacionamentos: estacionamentosRaw } = estacionamentosRes.ok
    ? await estacionamentosRes.json() as { estacionamentos: EstacionamentoApi[] }
    : { estacionamentos: [] as EstacionamentoApi[] }

  // Remapeia camelCase (Prisma) pra snake_case (shape que AtendenteClient já espera)
  const estacionamentos = estacionamentosRaw.map(e => ({
    id: e.id,
    nome: e.nome,
    cobra_modo: e.cobraModo,
    preco_fixo: e.precoFixo !== null ? Number(e.precoFixo) : null,
    preco_primeira_hora: e.precoPrimeiraHora !== null ? Number(e.precoPrimeiraHora) : null,
    preco_hora_adicional: e.precoHoraAdicional !== null ? Number(e.precoHoraAdicional) : null,
    teto_diario: e.tetoDiario !== null ? Number(e.tetoDiario) : null,
    tolerancia_minutos: e.toleranciaMinutos,
    controla_saida: e.controlaSaida,
    vagas_totais: e.vagasTotais,
    estacionamento_portoes: e.estacionamentoPortoes,
  }))

  return (
    <AtendenteClient
      eventoId={eventoId}
      eventoTitle={acesso.evento.title ?? 'Evento'}
      estacionamentos={estacionamentos}
      caixaId={caixaAberto?.id ?? null}
      caixaNome={caixaAberto?.nome ?? null}
      podeEntrada={podeEntrada}
      podeSaida={podeSaida}
      portaoRestrito={portaoRestrito}
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
