import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAdminMember } from '@/lib/adminAuth'
import { AdminSidebar } from './AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/admin')

  const member = await getAdminMember(user.id)
  if (!member) redirect('/')

  return (
    <div className="min-h-dvh bg-[#070707] flex">
      <AdminSidebar
        role={member.role}
        permissions={member.permissions}
        userName={user.user_metadata?.full_name ?? user.email ?? 'Admin'}
      />
      <main className="flex-1 min-h-dvh overflow-auto">
        {children}
      </main>
    </div>
  )
}
