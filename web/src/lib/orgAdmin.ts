import type { SupabaseClient } from '@supabase/supabase-js'

// Dono (organizations.owner_id) OU membro ativo em organization_admins.
// Mesma regra da function is_org_admin() no banco (usada nas policies de
// RLS) — mas em código de app, porque estas rotas usam o client de
// service role, que não passa por RLS nenhuma.
export async function isOrgAdmin(
  admin: SupabaseClient, organizationId: string, userId: string
): Promise<boolean> {
  const { data: org } = await admin
    .from('organizations').select('owner_id').eq('id', organizationId).single()
  if (org?.owner_id === userId) return true

  const { data: adminRow } = await admin
    .from('organization_admins')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('status', 'ativo')
    .maybeSingle()
  return !!adminRow
}
