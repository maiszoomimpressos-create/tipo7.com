// GET /api/check-phone?phone=11999999999
// Verifica se um telefone já está cadastrado (usado no cadastro para evitar duplicatas)
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimitLocal, getIp, tooManyRequests } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  if (!rateLimitLocal(getIp(req), 'check-phone', 5, 60_000)) return tooManyRequests()

  const phone = req.nextUrl.searchParams.get('phone')?.replace(/\D/g, '')
  if (!phone || phone.length < 10 || phone.length > 11) return NextResponse.json({ exists: false })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  return NextResponse.json({ exists: data !== null })
}
