import { createServiceClient } from '@/lib/supabase/server'

export type AdminRole = 'super_admin' | 'admin' | 'member'

export type AdminMember = {
  role:        AdminRole
  permissions: string[]
}

export async function getAdminMember(userId: string): Promise<AdminMember | null> {
  const admin = createServiceClient()
  const { data } = await admin
    .from('platform_team')
    .select('role, permissions')
    .eq('user_id', userId)
    .single()
  return data as AdminMember | null
}

export function can(member: AdminMember, perm: string): boolean {
  if (member.role === 'super_admin' || member.role === 'admin') return true
  return member.permissions.includes(perm)
}
