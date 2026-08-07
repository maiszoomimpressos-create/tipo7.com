import 'server-only'
import { apiFetchServer } from '@/lib/apiFetchServer'

export type AdminRole = 'super_admin' | 'admin' | 'member'

export type AdminMember = {
  role:            AdminRole
  permissions:     string[]
  acesso_restrito: boolean
}

// Porte de leitura direta de platform_settings pro NestJS (GET /admin/whoami,
// Fase 7.2) — o parâmetro userId é mantido só por compatibilidade com os 13
// call sites existentes (sempre o próprio usuário logado nesta mesma
// requisição); apiFetchServer já resolve a identidade via cookie.
export async function getAdminMember(userId: string): Promise<AdminMember | null> {
  const res = await apiFetchServer('/api/admin/whoami')
  if (!res.ok) return null
  const data = await res.json() as { role: AdminRole; permissions: string[]; acessoRestrito: boolean }
  return { role: data.role, permissions: data.permissions, acesso_restrito: data.acessoRestrito }
}

export function can(member: AdminMember, perm: string): boolean {
  if (member.role === 'super_admin' || member.role === 'admin') return true
  return member.permissions.includes(perm)
}

// Área restrita (Equipe, Financeiro, API) — mais rígida que can(): role
// 'admin' sozinho NÃO basta mais, precisa ser super_admin ou ter o acesso
// explicitamente concedido (acesso_restrito=true). Pensado pro fluxo futuro
// de senha própria de admin master/supervisor.
export function temAcessoRestrito(member: AdminMember): boolean {
  return member.role === 'super_admin' || member.acesso_restrito === true
}
