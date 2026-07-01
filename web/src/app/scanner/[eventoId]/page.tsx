import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShieldX  } from 'lucide-react'
import { ScannerClient } from './ScannerClient'

interface Props {
  params: Promise<{ eventoId: string }>
}

export default async function ScannerPage({ params }: Props) {
  const { eventoId } = await params
  const supabase     = await createClient()

  // Exige login
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?next=/scanner/${eventoId}`)

  const admin = createServiceClient()

  // Busca evento
  const { data: evento } = await admin
    .from('events')
    .select('id, title, organization_id')
    .eq('id', eventoId)
    .single()

  if (!evento) {
    return <SemPermissao mensagem="Evento não encontrado." />
  }

  // Verifica se é organizador
  const { data: org } = await admin
    .from('organizations')
    .select('owner_id')
    .eq('id', evento.organization_id)
    .single()

  const isOwner = org?.owner_id === user.id

  // Verifica se é staff com permissão validar_ingresso
  let isStaff = false
  let staffName = ''
  if (!isOwner) {
    const { data: staff } = await admin
      .from('event_staff')
      .select('id, profiles:user_id(full_name), event_positions(event_position_permissions(permission))')
      .eq('event_id', eventoId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (staff) {
      const pos = staff.event_positions as unknown as {
        event_position_permissions: { permission: string }[]
      } | null
      isStaff = (pos?.event_position_permissions ?? []).some(p => p.permission === 'validar_ingresso')
      const profileData = staff.profiles as unknown as { full_name: string | null } | null
      staffName = profileData?.full_name ?? ''
    }
  }

  if (!isOwner && !isStaff) {
    return <SemPermissao mensagem="Você não tem permissão para escanear ingressos neste evento." />
  }

  // Busca nome do usuário para exibir no scanner
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const displayName = profile?.full_name ?? staffName ?? 'Operador'

  return (
    <ScannerClient
      eventoId={eventoId}
      eventoTitle={evento.title ?? 'Evento'}
      operadorName={displayName}
    />
  )
}

function SemPermissao({ mensagem }: { mensagem: string }) {
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
      <a
        href="/"
        className="mt-2 text-sm text-[#E8B84B] hover:underline"
        style={{ fontFamily: 'var(--font-dm-sans)' }}
      >
        Voltar ao início
      </a>
    </div>
  )
}
