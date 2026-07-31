import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/organizations/pedidos-pendentes — convites de sócio ENVIADOS
// (não os recebidos) de todas as organizações que o usuário administra,
// ainda sem resposta. Agrega entre organizações pra não precisar abrir
// card por card só pra ver quem ainda não respondeu.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()

  const { data: minhasOrgs } = await admin
    .from('organization_admins')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'ativo')

  const orgIds = (minhasOrgs ?? []).map(r => r.organization_id)
  if (orgIds.length === 0) return NextResponse.json({ pedidos: [] })

  const { data: rows } = await admin
    .from('organization_admins')
    .select(`
      id, participacao, percentual, created_at,
      organizations (name, nome_fantasia),
      profiles!organization_admins_user_id_fkey (full_name, user_code)
    `)
    .in('organization_id', orgIds)
    .eq('status', 'convidado')
    .neq('user_id', user.id)
    .order('created_at', { ascending: false })

  const pedidos = (rows ?? []).map(r => {
    const org    = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations
    const pessoa = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    return {
      id:           r.id,
      organizacao:  org?.nome_fantasia || org?.name || 'Organização',
      participacao: r.participacao,
      percentual:   r.percentual,
      nome:         pessoa?.full_name ?? null,
      codigo:       pessoa?.user_code ?? null,
      criadoEm:     r.created_at,
    }
  })

  return NextResponse.json({ pedidos })
}
