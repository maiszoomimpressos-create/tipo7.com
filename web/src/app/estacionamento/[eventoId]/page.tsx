import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShieldX } from 'lucide-react'
import { GerenciadorEstacionamentos } from './GerenciadorEstacionamentos'
import { AtendenteClient } from './AtendenteClient'

interface Props {
  params: Promise<{ eventoId: string }>
}

export default async function EstacionamentoPage({ params }: Props) {
  const { eventoId } = await params
  const supabase     = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?next=/estacionamento/${eventoId}`)

  const admin = createServiceClient()

  const { data: evento } = await admin
    .from('events')
    .select('id, title, organization_id')
    .eq('id', eventoId)
    .single()

  if (!evento) return <SemPermissao mensagem="Evento não encontrado." />

  const { data: org } = await admin
    .from('organizations')
    .select('owner_id')
    .eq('id', evento.organization_id)
    .single()

  const isOwner = org?.owner_id === user.id

  if (isOwner) {
    return <GerenciadorEstacionamentos eventoId={eventoId} eventoTitle={evento.title ?? 'Evento'} />
  }

  // Staff com permissão de entrada e/ou saída do estacionamento
  const { data: staff } = await admin
    .from('event_staff')
    .select('id, portao_id, event_positions(event_position_permissions(permission))')
    .eq('event_id', eventoId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  const pos = staff?.event_positions as unknown as {
    event_position_permissions: { permission: string }[]
  } | null
  const permissoes    = pos?.event_position_permissions ?? []
  const podeEntrada   = permissoes.some(p => p.permission === 'estacionamento_entrada')
  const podeSaida     = permissoes.some(p => p.permission === 'estacionamento_saida')
  const portaoRestrito = staff?.portao_id ?? null

  if (!podeEntrada && !podeSaida) {
    return <SemPermissao mensagem="Você não tem permissão para acessar o estacionamento deste evento." />
  }

  // Caixa aberto designado a este operador (se houver) — usado só na hora de cobrar
  const { data: caixaAberto } = await admin
    .from('caixas')
    .select('id, nome')
    .eq('evento_id', eventoId)
    .eq('operador_id', user.id)
    .eq('status', 'aberto')
    .maybeSingle()

  const { data: estacionamentos } = await admin
    .from('estacionamentos')
    .select('*, estacionamento_portoes(*)')
    .eq('event_id', eventoId)
    .eq('ativo', true)
    .order('created_at')

  return (
    <AtendenteClient
      eventoId={eventoId}
      eventoTitle={evento.title ?? 'Evento'}
      estacionamentos={estacionamentos ?? []}
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
