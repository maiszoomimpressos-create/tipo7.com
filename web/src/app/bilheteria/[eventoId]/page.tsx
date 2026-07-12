import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShieldX } from 'lucide-react'
import { GerenciadorCaixas } from './GerenciadorCaixas'

interface Props {
  params: Promise<{ eventoId: string }>
}

export default async function BilheteriaPage({ params }: Props) {
  const { eventoId } = await params
  const supabase     = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?next=/bilheteria/${eventoId}`)

  const admin = createServiceClient()

  const { data: evento } = await admin
    .from('events')
    .select('id, title, date_start, venue_name, city, state, organization_id')
    .eq('id', eventoId)
    .single()

  if (!evento) return <SemPermissao mensagem="Evento não encontrado." />

  const { data: org } = await admin
    .from('organizations')
    .select('owner_id')
    .eq('id', evento.organization_id)
    .single()

  const isOwner = org?.owner_id === user.id

  // Operadores com permissão vender_ingresso são redirecionados ao caixa designado
  if (!isOwner) {
    const { data: staff } = await admin
      .from('event_staff')
      .select('id, event_positions(event_position_permissions(permission))')
      .eq('event_id', eventoId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (staff) {
      const pos = staff.event_positions as unknown as {
        event_position_permissions: { permission: string }[]
      } | null
      const isVendedor = (pos?.event_position_permissions ?? []).some(p => p.permission === 'vender_ingresso')

      if (isVendedor) {
        // Busca caixa aberto designado para este operador
        const { data: caixa } = await admin
          .from('caixas')
          .select('id')
          .eq('evento_id', eventoId)
          .eq('operador_id', user.id)
          .eq('status', 'aberto')
          .single()

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
          </div>
        )
      }
    }

    return <SemPermissao mensagem="Você não tem permissão para acessar a bilheteria deste evento." />
  }

  // Dono do evento: painel de gerenciamento de caixas
  return (
    <GerenciadorCaixas
      eventoId={eventoId}
      eventoTitle={evento.title ?? 'Evento'}
      userId={user.id}
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
      <a href="/" className="mt-2 text-sm hover:underline" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
        Voltar ao início
      </a>
    </div>
  )
}

const ACCENT = '#E8B84B'
