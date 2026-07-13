// GET /api/checkout/gateway?eventoId=X
// ─────────────────────────────────────────────────────────────────────────────
// Retorna qual gateway de pagamento está configurado para um evento.
// Usado pelo frontend para decidir qual fluxo de checkout exibir.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveEventGateway } from '@/lib/resolveGateway'

export async function GET(req: NextRequest) {
  // Verifica autenticação do comprador
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const eventoId = req.nextUrl.searchParams.get('eventoId')
  if (!eventoId) return NextResponse.json({ error: 'eventoId obrigatório' }, { status: 400 })

  const admin = createServiceClient()
  const { gateway } = await resolveEventGateway(eventoId, admin)

  return NextResponse.json({ gateway })
}
