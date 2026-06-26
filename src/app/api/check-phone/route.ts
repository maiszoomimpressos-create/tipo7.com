// GET /api/check-phone?phone=11999999999
// Verifica se um telefone já está cadastrado (compara apenas dígitos)
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('phone')?.replace(/\D/g, '')
  if (!raw || raw.length < 10) return NextResponse.json({ exists: false })

  const admin = createServiceClient()
  // Compara removendo não-dígitos de ambos os lados via regexp_replace
  const { data } = await admin
    .rpc('check_phone_exists', { phone_digits: raw })

  return NextResponse.json({ exists: data === true })
}
