// PATCH /api/admin/payment-credentials
// Salva as credenciais da própria conta Tipo7 nos gateways de pagamento —
// separado de /api/admin/settings (tarifas) porque aqui são segredos, com
// exigência de acesso mais restrita (mesma barra da página Bancos).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember, temAcessoRestrito } from '@/lib/adminAuth'
import { MP_CRED_KEYS } from '@/lib/platformCredentials'

const CHAVES_VALIDAS = new Set<string>(MP_CRED_KEYS)

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const member = await getAdminMember(user.id)
  if (!member || !temAcessoRestrito(member)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json() as Record<string, unknown>
  const rows: { key: string; value: string }[] = []

  for (const [key, val] of Object.entries(body)) {
    if (val === undefined) continue
    if (!CHAVES_VALIDAS.has(key)) {
      return NextResponse.json({ error: `Chave desconhecida: ${key}` }, { status: 400 })
    }
    if (typeof val !== 'string') {
      return NextResponse.json({ error: `${key} deve ser um texto` }, { status: 400 })
    }
    rows.push({ key, value: val.trim() })
  }

  const admin = createServiceClient()
  const now   = new Date().toISOString()

  await Promise.all(
    rows.map(({ key, value }) =>
      admin.from('platform_settings').upsert({ key, value, updated_at: now }, { onConflict: 'key' })
    )
  )

  return NextResponse.json({ ok: true })
}
