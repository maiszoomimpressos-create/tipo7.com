import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember } from '@/lib/adminAuth'
import { redirect } from 'next/navigation'
import { ConteudoClient } from './ConteudoClient'

export default async function ConteudoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const me = await getAdminMember(user.id)
  if (!me || me.role !== 'super_admin') redirect('/admin')

  const admin = createServiceClient()
  const { data } = await admin
    .from('platform_content')
    .select('key, content')
    .in('key', ['termos', 'privacidade', 'lgpd'])

  const rows = data ?? []
  const termos      = rows.find(r => r.key === 'termos')?.content      ?? ''
  const privacidade = rows.find(r => r.key === 'privacidade')?.content ?? ''
  const lgpd        = rows.find(r => r.key === 'lgpd')?.content        ?? ''

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Conteúdo da Plataforma
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Edite os textos legais exibidos para os usuários
        </p>
      </div>
      <ConteudoClient termos={termos} privacidade={privacidade} lgpd={lgpd} />
    </div>
  )
}
