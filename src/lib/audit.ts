// Utilitário de auditoria — registra ações críticas na tabela audit_logs.
// Nunca lança exceção: falha silenciosa para não interromper o fluxo principal.
import { createServiceClient } from '@/lib/supabase/server'

interface AuditParams {
  userId?: string | null
  action: string
  resourceType?: string
  resourceId?: string
  details?: Record<string, unknown>
  ip?: string
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const admin = createServiceClient()
    await admin.from('audit_logs').insert({
      user_id:       params.userId ?? null,
      action:        params.action,
      resource_type: params.resourceType ?? null,
      resource_id:   params.resourceId ?? null,
      details:       params.details ?? null,
      ip:            params.ip ?? null,
    })
  } catch (err) {
    console.error('[audit] falha ao registrar:', err)
  }
}
