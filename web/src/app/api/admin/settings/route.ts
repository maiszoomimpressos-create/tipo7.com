import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember, can } from '@/lib/adminAuth'

const MODULE_PREFIXES = ['', 'bilheteria_', 'tenda_', 'estacionamento_'] as const

const PERCENT_KEYS = new Set([
  'fee_pct_pix', 'fee_pct_credito_1x', 'fee_pct_credito_6x', 'fee_pct_credito_12x',
  ...MODULE_PREFIXES.flatMap(p => [`${p}default_fee_pct`, `${p}min_fee_pct`]),
])

const EXTRA_VALUE_KEYS = new Set(
  MODULE_PREFIXES.flatMap(p => [1, 2].map(n => `${p}extra_fee_${n}_value`))
)
const EXTRA_LABEL_KEYS = new Set(
  MODULE_PREFIXES.flatMap(p => [1, 2].map(n => `${p}extra_fee_${n}_label`))
)
const EXTRA_TYPE_KEYS = new Set(
  MODULE_PREFIXES.flatMap(p => [1, 2].map(n => `${p}extra_fee_${n}_type`))
)

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const member = await getAdminMember(user.id)
  if (!member || !can(member, 'gerenciar_financeiro')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json() as Record<string, unknown>
  const rows: { key: string; value: string }[] = []

  for (const [key, val] of Object.entries(body)) {
    if (val === undefined) continue

    if (PERCENT_KEYS.has(key)) {
      if (typeof val !== 'number' || val < 0 || val > 100) {
        return NextResponse.json({ error: `${key} deve ser um número entre 0 e 100` }, { status: 400 })
      }
      rows.push({ key, value: String(val) })
    } else if (EXTRA_VALUE_KEYS.has(key)) {
      if (typeof val !== 'number' || val < 0 || val > 1000000) {
        return NextResponse.json({ error: `${key} deve ser um número entre 0 e 1000000` }, { status: 400 })
      }
      rows.push({ key, value: String(val) })
    } else if (EXTRA_TYPE_KEYS.has(key)) {
      if (val !== 'fixed' && val !== 'percent') {
        return NextResponse.json({ error: `${key} deve ser "fixed" ou "percent"` }, { status: 400 })
      }
      rows.push({ key, value: val })
    } else if (EXTRA_LABEL_KEYS.has(key)) {
      if (typeof val !== 'string' || val.length > 60) {
        return NextResponse.json({ error: `${key} deve ser um texto de até 60 caracteres` }, { status: 400 })
      }
      rows.push({ key, value: val.trim() })
    } else {
      return NextResponse.json({ error: `Chave desconhecida: ${key}` }, { status: 400 })
    }
  }

  const admin = createServiceClient()
  const now   = new Date().toISOString()

  await Promise.all(
    rows.map(({ key, value }) =>
      admin.from('platform_settings')
        .upsert({ key, value, updated_at: now }, { onConflict: 'key' })
    )
  )

  return NextResponse.json({ ok: true })
}
