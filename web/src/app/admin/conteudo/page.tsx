import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { getAdminMember } from '@/lib/adminAuth'
import { redirect } from 'next/navigation'
import { ConteudoClient } from './ConteudoClient'

export default async function ConteudoPage() {
  const user = await getAuthUser()
  if (!user) redirect('/auth')

  const me = await getAdminMember(user.id)
  if (!me || me.role !== 'super_admin') redirect('/admin')

  // GET /admin/conteudo?key=X é pública e só aceita uma chave por vez — 3
  // chamadas paralelas em vez de ampliar a rota (Fase 7.2, G15).
  const [termosRes, privacidadeRes, lgpdRes] = await Promise.all([
    apiFetchServer('/api/admin/conteudo?key=termos'),
    apiFetchServer('/api/admin/conteudo?key=privacidade'),
    apiFetchServer('/api/admin/conteudo?key=lgpd'),
  ])
  const termos      = termosRes.ok      ? (await termosRes.json() as { content: string }).content      : ''
  const privacidade = privacidadeRes.ok ? (await privacidadeRes.json() as { content: string }).content : ''
  const lgpd         = lgpdRes.ok        ? (await lgpdRes.json() as { content: string }).content         : ''

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
