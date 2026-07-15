// GET /api/check-cnpj?cnpj=00000000000000[&exclude_org=uuid]
// Verifica se um CNPJ já está cadastrado por OUTRA organização
// exclude_org: UUID da org do próprio usuário — evita falso positivo ao voltar e reeditar
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimitLocal, getIp, tooManyRequests } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  if (!rateLimitLocal(getIp(req), 'check-cnpj', 5, 60_000)) return tooManyRequests()

  const params      = req.nextUrl.searchParams
  const cnpj        = params.get('cnpj')?.replace(/\D/g, '')
  const excludeOrg  = params.get('exclude_org') ?? null

  if (!cnpj || cnpj.length !== 14) return NextResponse.json({ exists: false })

  const supabase = createServiceClient()
  let query = supabase
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .eq('cnpj', cnpj)

  if (excludeOrg) query = query.neq('id', excludeOrg)

  const { count } = await query

  return NextResponse.json({ exists: (count ?? 0) > 0 })
}
