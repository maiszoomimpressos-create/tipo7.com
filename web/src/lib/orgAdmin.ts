import 'server-only'
import { apiFetchServer } from '@/lib/apiFetchServer'

// Porte pro NestJS (GET /organizations/:id/sou-admin, Fase 7.2) — os
// parâmetros `_admin`/`_userId` são mantidos só por compatibilidade com os
// 13 call sites existentes (todos passam o client de service role e
// user.id do próprio usuário logado nesta mesma requisição); apiFetchServer
// já resolve a identidade via cookie, e a checagem de dono/admin ativo
// acontece no NestJS (mesma regra de antes: organizations.owner_id OU
// organization_admins ativo — ver OrgAdminService no server/).
export async function isOrgAdmin(
  _admin: unknown, organizationId: string, _userId: string
): Promise<boolean> {
  const res = await apiFetchServer(`/api/organizations/${organizationId}/sou-admin`)
  if (!res.ok) return false
  const data = await res.json() as { isOrgAdmin: boolean }
  return data.isOrgAdmin
}
