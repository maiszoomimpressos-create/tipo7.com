import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember, can } from '@/lib/adminAuth'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const member = await getAdminMember(user.id)
  if (!member || !can(member, 'gerenciar_financeiro')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const ALLOWED_KEYS = [
    'default_fee_pct',
    'min_fee_pct',
    'fee_pct_pix',
    'fee_pct_credito_1x',
    'fee_pct_credito_6x',
    'fee_pct_credito_12x',
  ] as const

  const body = await req.json() as Partial<Record<typeof ALLOWED_KEYS[number], number>>

  for (const [key, val] of Object.entries(body)) {
    if (!ALLOWED_KEYS.includes(key as typeof ALLOWED_KEYS[number])) {
      return NextResponse.json({ error: `Chave desconhecida: ${key}` }, { status: 400 })
    }
    if (val !== undefined && (typeof val !== 'number' || val < 0 || val > 100)) {
      return NextResponse.json({ error: `${key} deve ser um número entre 0 e 100` }, { status: 400 })
    }
  }

  const admin = createServiceClient()
  const now   = new Date().toISOString()

  await Promise.all(
    Object.entries(body)
      .filter(([, v]) => v !== undefined)
      .map(([key, val]) =>
        admin.from('platform_settings')
          .upsert({ key, value: String(val), updated_at: now }, { onConflict: 'key' })
      )
  )

  return NextResponse.json({ ok: true })
}
