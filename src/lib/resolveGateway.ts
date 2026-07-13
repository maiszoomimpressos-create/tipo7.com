// Resolve qual gateway de pagamento está configurado para um evento
// e retorna o ID do dono da organização para cálculo de taxa da plataforma.
import type { SupabaseClient } from '@supabase/supabase-js'

export type Gateway = 'mercadopago' | 'pagbank'

export interface GatewayInfo {
  gateway: Gateway
  ownerId: string | null
}

// Busca o gateway e o dono do evento em uma única query com join.
// Retorna 'mercadopago' como padrão caso o evento não tenha gateway configurado.
export async function resolveEventGateway(
  eventoId: string,
  admin:    SupabaseClient,
): Promise<GatewayInfo> {
  const { data } = await admin
    .from('events')
    .select('payment_gateway, organization_id, organizations(owner_id)')
    .eq('id', eventoId)
    .single()

  // Extrai owner_id do join (pode vir como objeto ou array dependendo do Supabase)
  const orgRaw  = data?.organizations as unknown
  const orgData = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as { owner_id: string } | null

  return {
    gateway: (data?.payment_gateway as Gateway | undefined) ?? 'mercadopago',
    ownerId: orgData?.owner_id ?? null,
  }
}
