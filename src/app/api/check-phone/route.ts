// GET /api/check-phone?phone=11999999999
// Verifica se um telefone já está cadastrado (compara apenas dígitos)
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getIp, tooManyRequests } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  if (!rateLimit(getIp(req), 'check-phone', 5, 60_000)) return tooManyRequests()

  const raw = req.nextUrl.searchParams.get('phone')?.replace(/\D/g, '')
  if (!raw || raw.length < 10) return NextResponse.json({ exists: false })

  const supabase = await createClient()
  const { data } = await supabase.rpc('check_phone_exists', { phone_digits: raw })

  return NextResponse.json({ exists: data === true })
}
