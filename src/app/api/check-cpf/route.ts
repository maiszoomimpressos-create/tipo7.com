// GET /api/check-cpf?cpf=12345678901
// Verifica se um CPF já está cadastrado (usado no cadastro para evitar duplicatas)
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimitLocal, getIp, tooManyRequests } from '@/lib/rateLimit'

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
  if (!rateLimitLocal(getIp(req), 'check-cpf', 5, 60_000)) return tooManyRequests()

  const cpf = req.nextUrl.searchParams.get('cpf')?.replace(/\D/g, '')
  if (!cpf || cpf.length !== 11 || !cpfValido(cpf)) return NextResponse.json({ exists: false })

  const supabase = await createClient()
  const { data } = await supabase.rpc('check_cpf_exists', { cpf_digits: cpf })

  return NextResponse.json({ exists: data === true })
}
