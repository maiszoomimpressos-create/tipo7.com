import { createServiceClient } from '@/lib/supabase/server'

// Dono do evento sempre tem acesso a tudo, independente de cargo/permissão
export async function isEventOwner(userId: string, eventoId: string): Promise<boolean> {
  const admin = createServiceClient()

  const { data: evento } = await admin.from('events').select('organization_id').eq('id', eventoId).single()
  if (!evento) return false

  const { data: org } = await admin.from('organizations').select('owner_id').eq('id', evento.organization_id).single()
  return org?.owner_id === userId
}

// Dono do evento OU staff ativo com a permissão informada (event_permission enum)
export async function hasEventPermission(userId: string, eventoId: string, permission: string): Promise<boolean> {
  if (await isEventOwner(userId, eventoId)) return true

  const admin = createServiceClient()
  const { data: staff } = await admin
    .from('event_staff')
    .select('id, event_positions(event_position_permissions(permission))')
    .eq('event_id', eventoId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (!staff) return false
  const pos = staff.event_positions as unknown as {
    event_position_permissions: { permission: string }[]
  } | null
  return (pos?.event_position_permissions ?? []).some(p => p.permission === permission)
}
