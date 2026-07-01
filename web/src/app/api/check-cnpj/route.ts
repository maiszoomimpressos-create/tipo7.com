// GET /api/check-cnpj?cnpj=00000000000000
// Verifica se um CNPJ já está cadastrado
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimitLocal, getIp, tooManyRequests } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  if (!rateLimitLocal(getIp(req), 'check-cnpj', 5, 60_000)) return tooManyRequests()

  const cnpj = req.nextUrl.searchParams.get('cnpj')?.replace(/\D/g, '')
  if (!cnpj || cnpj.length !== 14) return NextResponse.json({ exists: false })

  const supabase = await createClient()
  const { data } = await supabase.rpc('check_cnpj_exists', { cnpj_digits: cnpj })

  return NextResponse.json({ exists: data === true })
}
