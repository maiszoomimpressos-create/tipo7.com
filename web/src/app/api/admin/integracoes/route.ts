import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember } from '@/lib/adminAuth'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const me = await getAdminMember(user.id)
  if (!me || me.role !== 'super_admin') return null
  return me
}

// GET /api/admin/integracoes
// Lista as integrações (com credenciais — só acessível a super_admin, já
// gated aqui e na página) e suas rotas documentadas, ordenadas.
export async function GET() {
  const me = await requireSuperAdmin()
  if (!me) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createServiceClient()
  const { data: integracoes, error } = await admin
    .from('api_integracoes')
    .select('id, area_slug, nome, base_url, api_key, webhook_secret, updated_at')
    .order('area_slug')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: rotas } = await admin
    .from('api_integracao_rotas')
    .select('id, integracao_id, rota, direcao, gatilho, campos_envia, campos_recebe, observacao, order_index')
    .order('order_index')

  const resultado = (integracoes ?? []).map(i => ({
    ...i,
    rotas: (rotas ?? []).filter(r => r.integracao_id === i.id),
  }))

  return NextResponse.json({ integracoes: resultado })
}
