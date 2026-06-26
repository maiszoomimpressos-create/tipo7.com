// GET /api/check-cnpj?cnpj=00000000000000
// Verifica se um CNPJ já está cadastrado
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const cnpj = req.nextUrl.searchParams.get('cnpj')?.replace(/\D/g, '')
  if (!cnpj || cnpj.length !== 14) return NextResponse.json({ exists: false })

  const admin = createServiceClient()
  const { count } = await admin
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .eq('cnpj', cnpj)

  return NextResponse.json({ exists: (count ?? 0) > 0 })
}
