import { NextResponse }                from 'next/server'
import { createClient }               from '@/lib/supabase/server'
import { getAdminMember, can }        from '@/lib/adminAuth'

// Taxas padrão públicas do MP Brasil (fallback quando API não retorna)
const DEFAULT_RATES = {
  pix:         '0,99',
  debito:      '1,49',
  credito_1x:  '4,98',
  credito_6x:  '5,98',
  credito_12x: '6,98',
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const member = await getAdminMember(user.id)
  if (!member || !can(member, 'gerenciar_financeiro')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const token = process.env.MP_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ rates: DEFAULT_RATES, source: 'default' })
  }

  try {
    // Tenta buscar dados da conta MP da plataforma
    const [meRes, methodsRes] = await Promise.all([
      fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch('https://api.mercadopago.com/v1/payment_methods', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])

    const me      = meRes.ok      ? await meRes.json()      : null
    const methods = methodsRes.ok ? await methodsRes.json() : null

    // O MP não expõe taxas individuais via API pública —
    // retornamos o que encontramos + os defaults editáveis
    return NextResponse.json({
      rates:   DEFAULT_RATES,
      source:  'mp_api',
      account: me ? { id: me.id, email: me.email, site_id: me.site_id } : null,
      methods: Array.isArray(methods) ? methods.map((m: { id: string; name: string; payment_type_id: string }) => ({
        id:   m.id,
        name: m.name,
        type: m.payment_type_id,
      })) : [],
    })
  } catch {
    return NextResponse.json({ rates: DEFAULT_RATES, source: 'default' })
  }
}
