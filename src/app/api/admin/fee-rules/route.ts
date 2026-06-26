import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember, can } from '@/lib/adminAuth'

async function assertFinanceiro() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const member = await getAdminMember(user.id)
  if (!member || !can(member, 'gerenciar_financeiro')) return null
  return user
}

// Lista todas as regras com nome do evento/promotor e quota usada
export async function GET() {
  const user = await assertFinanceiro()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createServiceClient()

  const { data: rules, error } = await admin
    .from('fee_rules')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enriquece cada regra com nome do evento ou promotor
  const enriched = await Promise.all((rules ?? []).map(async rule => {
    let event_title:    string | null = null
    let promoter_name:  string | null = null
    let quota_used:     number        = 0

    if (rule.event_id) {
      const { data } = await admin.from('events').select('title').eq('id', rule.event_id).single()
      event_title = data?.title ?? null
    }

    if (rule.user_id) {
      const { data } = await admin.from('profiles').select('full_name').eq('id', rule.user_id).single()
      promoter_name = data?.full_name ?? null
    }

    if (rule.type === 'global_quota' && rule.quota_limit) {
      const desde = rule.quota_period === 'monthly'
        ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
        : '2000-01-01T00:00:00Z'
      const { data: orders } = await admin.from('orders').select('id').eq('status', 'approved').gte('created_at', desde)
      const ids = (orders ?? []).map(o => o.id)
      if (ids.length) {
        const { data: items } = await admin.from('order_items').select('quantity').in('order_id', ids)
        quota_used = (items ?? []).reduce((s, i) => s + i.quantity, 0)
      }
    }

    if (rule.type === 'promoter_quota' && rule.user_id && rule.quota_limit) {
      const desde = rule.quota_period === 'monthly'
        ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
        : '2000-01-01T00:00:00Z'
      const { data: orgs } = await admin.from('organizations').select('id').eq('owner_id', rule.user_id)
      const orgIds = (orgs ?? []).map(o => o.id)
      if (orgIds.length) {
        const { data: evs } = await admin.from('events').select('id').in('organization_id', orgIds)
        const evIds = (evs ?? []).map(e => e.id)
        if (evIds.length) {
          const { data: orders } = await admin.from('orders').select('id').in('event_id', evIds).eq('status', 'approved').gte('created_at', desde)
          const ids = (orders ?? []).map(o => o.id)
          if (ids.length) {
            const { data: items } = await admin.from('order_items').select('quantity').in('order_id', ids)
            quota_used = (items ?? []).reduce((s, i) => s + i.quantity, 0)
          }
        }
      }
    }

    return { ...rule, event_title, promoter_name, quota_used }
  }))

  return NextResponse.json({ rules: enriched })
}

// Cria nova regra
export async function POST(req: NextRequest) {
  const user = await assertFinanceiro()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as {
    name:             string
    type:             string
    event_id?:        string
    user_id?:         string
    discount_pct?:    number
    quota_limit?:     number
    quota_period?:    string
    bypass_minimum?:  boolean
    notes?:           string
  }

  const TIPOS_VALIDOS = ['event', 'promoter_quota', 'global_quota']
  if (!body.name || !body.type) {
    return NextResponse.json({ error: 'Nome e tipo são obrigatórios' }, { status: 400 })
  }
  if (!TIPOS_VALIDOS.includes(body.type)) {
    return NextResponse.json({ error: `Tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}` }, { status: 400 })
  }
  if (body.discount_pct !== undefined && (body.discount_pct < 0 || body.discount_pct > 100)) {
    return NextResponse.json({ error: 'discount_pct deve ser entre 0 e 100' }, { status: 400 })
  }

  const admin = createServiceClient()
  const { data, error } = await admin
    .from('fee_rules')
    .insert({
      name:            body.name,
      type:            body.type,
      event_id:        body.event_id        || null,
      user_id:         body.user_id         || null,
      discount_pct:    body.discount_pct    ?? 100,
      quota_limit:     body.quota_limit     || null,
      quota_period:    body.quota_period    || null,
      bypass_minimum:  body.bypass_minimum  ?? false,
      notes:           body.notes           || null,
      created_by:      user.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data })
}

// Desativa ou exclui uma regra
export async function DELETE(req: NextRequest) {
  const user = await assertFinanceiro()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const admin = createServiceClient()
  await admin.from('fee_rules').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
