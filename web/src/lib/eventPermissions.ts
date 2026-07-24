import { createServiceClient } from '@/lib/supabase/server'

// Dono do evento sempre tem acesso a tudo, independente de cargo/permissão
export async function isEventOwner(userId: string, eventoId: string): Promise<boolean> {
  const admin = createServiceClient()

  const { data: evento } = await admin.from('events').select('organization_id').eq('id', eventoId).single()
  if (!evento) return false

  const { data: org } = await admin.from('organizations').select('owner_id').eq('id', evento.organization_id).single()
  return org?.owner_id === userId
}

// Dono do evento OU staff ativo com a permissão informada (event_permission enum).
// Aceita uma permissão só ou uma lista — nesse caso basta ter QUALQUER uma delas
// (ex: leitura de sessões de estacionamento serve tanto pra quem só faz entrada
// quanto pra quem só faz saída).
export async function hasEventPermission(
  userId: string, eventoId: string, permission: string | string[]
): Promise<boolean> {
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
  const required = Array.isArray(permission) ? permission : [permission]
  return (pos?.event_position_permissions ?? []).some(p => required.includes(p.permission))
}

// Portão ao qual esse membro da equipe está restrito (null = sem restrição,
// pode operar qualquer portão do estacionamento em que tiver permissão).
// Dono do evento nunca tem restrição de portão.
export async function getStaffPortao(userId: string, eventoId: string): Promise<string | null> {
  if (await isEventOwner(userId, eventoId)) return null

  const admin = createServiceClient()
  const { data: staff } = await admin
    .from('event_staff')
    .select('portao_id')
    .eq('event_id', eventoId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  return staff?.portao_id ?? null
}
