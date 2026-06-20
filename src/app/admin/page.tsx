// Painel admin master — acesso restrito ao dono da plataforma
// Redireciona qualquer outro usuário para a home
import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { Header }       from '@/components/layout/Header'
import { AdminClient }  from './AdminClient'

const ADMIN_EMAIL = 'maiszoomimpressos@gmail.com'

export default async function AdminPage() {
  // Verifica autenticação
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Bloqueia acesso: deve estar logado E ser o admin
  if (!user || user.email !== ADMIN_EMAIL) redirect('/')

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-10">

        {/* Cabeçalho */}
        <div className="mb-8 flex items-center gap-3">
          <div className="w-2 h-8 bg-[#E8B84B] rounded-full" />
          <div>
            <h1
              className="text-2xl text-white leading-tight"
              style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}
            >
              Painel Admin
            </h1>
            <p className="text-[#444] text-sm mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Visão interna da plataforma — apenas você vê isso
            </p>
          </div>
        </div>

        <AdminClient />

      </main>
    </div>
  )
}
