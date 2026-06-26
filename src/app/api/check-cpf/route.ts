// GET /api/check-cpf?cpf=12345678901
// Verifica se um CPF já está cadastrado (usado no cadastro para evitar duplicatas)
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Valida os dois dígitos verificadores do CPF
function cpfValido(cpf: string): boolean {
  if (/^(\d)\1{10}$/.test(cpf)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i)
  let d1 = 11 - (sum % 11)
  if (d1 >= 10) d1 = 0
  if (d1 !== parseInt(cpf[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i)
  let d2 = 11 - (sum % 11)
  if (d2 >= 10) d2 = 0
  return d2 === parseInt(cpf[10])
}

export async function GET(req: NextRequest) {
  const cpf = req.nextUrl.searchParams.get('cpf')?.replace(/\D/g, '')
  if (!cpf || cpf.length !== 11 || !cpfValido(cpf)) return NextResponse.json({ exists: false })

  const admin = createServiceClient()
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('cpf', cpf)

  return NextResponse.json({ exists: (count ?? 0) > 0 })
}
