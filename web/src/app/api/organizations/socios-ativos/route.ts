import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/organizations/socios-ativos — todo mundo que já ACEITOU
// administrar alguma das organizações do usuário (dono integral + sócios),
// com dados completos. Sem isso não tinha nenhum lugar visível pra saber
// quem são os responsáveis por um estabelecimento depois que o convite é
// aceito — só o convite pendente aparecia em algum lugar.
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
  if (orgIds.length === 0) return NextResponse.json({ socios: [] })

  const { data: rows } = await admin
    .from('organization_admins')
    .select(`
      id, user_id, participacao, percentual,
      organizations (name, nome_fantasia),
      profiles!organization_admins_user_id_fkey (full_name, user_code)
    `)
    .in('organization_id', orgIds)
    .eq('status', 'ativo')
    .order('created_at')

  const userIds = Array.from(new Set((rows ?? []).map(r => r.user_id)))
  const { data: emailRowsRaw } = userIds.length > 0
    ? await admin.rpc('get_emails_by_ids', { p_ids: userIds })
    : { data: [] }
  const emailMap = new Map(((emailRowsRaw ?? []) as { id: string; email: string }[]).map(e => [e.id, e.email]))

  const socios = (rows ?? []).map(r => {
    const org    = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations
    const pessoa = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    return {
      id:           r.id,
      organizacao:  org?.nome_fantasia || org?.name || 'Organização',
      participacao: r.participacao,
      percentual:   r.percentual,
      nome:         pessoa?.full_name ?? null,
      codigo:       pessoa?.user_code ?? null,
      email:        emailMap.get(r.user_id) ?? null,
      voceMesmo:    r.user_id === user.id,
    }
  })

  return NextResponse.json({ socios })
}
