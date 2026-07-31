import { createServiceClient } from '@/lib/supabase/server'

export type AdminRole = 'super_admin' | 'admin' | 'member'

export type AdminMember = {
  role:            AdminRole
  permissions:     string[]
  acesso_restrito: boolean
}

export async function getAdminMember(userId: string): Promise<AdminMember | null> {
  const admin = createServiceClient()
  const { data } = await admin
    .from('platform_team')
    .select('role, permissions, acesso_restrito')
    .eq('user_id', userId)
    .single()
  return data as AdminMember | null
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
