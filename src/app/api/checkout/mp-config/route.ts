// GET /api/checkout/mp-config?eventoId=X
// Retorna a public key do Mercado Pago associada ao promotor do evento.
// Necessária para inicializar o SDK do MP no client (tokenização do cartão).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const eventoId = req.nextUrl.searchParams.get('eventoId')
  if (!eventoId) return NextResponse.json({ error: 'eventoId required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()

  const { data: eventInfo } = await admin
    .from('events')
    .select('organization_id, organizations(owner_id)')
    .eq('id', eventoId)
    .single()

  const orgRaw  = eventInfo?.organizations as unknown
  const orgData = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as { owner_id: string } | null
  const ownerId = orgData?.owner_id

  // Fallback: usa a chave pública da plataforma se o promotor não conectou sua conta
  let publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? null

  if (ownerId) {
    const { data: mpAccount } = await admin
      .from('promotor_mp_accounts')
      .select('mp_public_key')
      .eq('user_id', ownerId)
      .maybeSingle()
    if (mpAccount?.mp_public_key) publicKey = mpAccount.mp_public_key
  }

  return NextResponse.json({ publicKey })
}
