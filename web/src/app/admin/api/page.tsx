import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember, temAcessoRestrito } from '@/lib/adminAuth'
import { redirect } from 'next/navigation'
import { Webhook } from 'lucide-react'
import { IntegracoesAccordion } from './IntegracoesAccordion'

export default async function ApiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const me = await getAdminMember(user.id)
  if (!me || !temAcessoRestrito(me)) redirect('/admin')

  const admin = createServiceClient()
  const [{ data: integracoes }, { data: rotas }] = await Promise.all([
    admin.from('api_integracoes').select('id, area_slug, nome, base_url, api_key, webhook_secret').order('area_slug'),
    admin.from('api_integracao_rotas').select('id, integracao_id, rota, direcao, gatilho, campos_envia, campos_recebe, observacao, order_index').order('order_index'),
  ])

  const dados = (integracoes ?? []).map(i => ({
    ...i,
    rotas: (rotas ?? []).filter(r => r.integracao_id === i.id),
  }))

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold flex items-center gap-2.5" style={{ fontFamily: 'var(--font-outfit)' }}>
          <Webhook size={22} className="text-[#E8B84B]" />
          API
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Integrações da plataforma com sistemas externos
        </p>
      </div>

      <IntegracoesAccordion integracoes={dados} />

    </div>
  )
}
