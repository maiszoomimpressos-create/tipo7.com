import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect }                          from 'next/navigation'
import { ShieldX }                           from 'lucide-react'
import { Header }                            from '@/components/layout/Header'
import { TrabalhoClient }                    from './TrabalhoClient'

interface Props {
  params: Promise<{ eventoId: string }>
}

export default async function TrabalhoPage({ params }: Props) {
  const { eventoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?next=/trabalho/${eventoId}`)

  const admin = createServiceClient()

  // Busca o vínculo do usuário com o evento
  const { data: staff } = await admin
    .from('event_staff')
    .select(`
      id, status,
      event_positions:event_position_id (
        id, name,
        event_position_permissions ( permission )
      )
    `)
    .eq('event_id', eventoId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  // Verifica se é organizador (pode acessar mesmo sem ser staff)
  const { data: evento } = await admin
    .from('events')
    .select('id, title, date_start, venue_name, city, state, banner_url, organization_id')
    .eq('id', eventoId)
    .single()

  if (!evento) return <SemAcesso mensagem="Evento não encontrado." />

  const { data: org } = await admin
    .from('organizations')
    .select('owner_id')
    .eq('id', evento.organization_id)
    .single()

  const isOwner = org?.owner_id === user.id

  if (!isOwner && !staff) {
    return <SemAcesso mensagem="Você não faz parte da equipe deste evento." />
  }

  const cargo = (staff?.event_positions as unknown) as {
    id: string
    name: string
    event_position_permissions: { permission: string }[]
  } | null

  const permissoes = isOwner
    ? ['validar_ingresso', 'vender_ingresso', 'ver_lista_convidados', 'ver_relatorios', 'gerenciar_checkin', 'gerenciar_equipe']
    : (cargo?.event_position_permissions ?? []).map(p => p.permission)

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />
      <TrabalhoClient
        eventoId={eventoId}
        eventoTitle={evento.title ?? 'Evento'}
        eventoDate={evento.date_start ?? null}
        eventoLocal={[evento.venue_name, evento.city, evento.state].filter(Boolean).join(' — ')}
        eventoBanner={evento.banner_url ?? null}
        cargoNome={isOwner ? 'Organizador' : (cargo?.name ?? 'Equipe')}
        permissoes={permissoes}
        isOwner={isOwner}
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
