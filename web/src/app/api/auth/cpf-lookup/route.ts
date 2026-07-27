// POST /api/auth/cpf-lookup
// body: { cpf }
// Consulta a Autosave por CPF durante o cadastro. Nunca devolve dado bruto —
// só uma dica mascarada de telefone/email, pra depois exigir confirmação
// (ver /api/auth/cpf-confirmar) antes de liberar o preenchimento automático.
// Não confirma nem nega explicitamente se o CPF existe além do necessário
// pra UX — mas como é preciso mostrar ALGO pro fluxo funcionar, "found"
// aqui só revela que existe um cadastro, nunca quem é.
import { NextRequest, NextResponse } from 'next/server'
import { buscarClientePorCpf } from '@/lib/autosave'
import { maskPhone, maskEmail } from '@/lib/mask'
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

export async function POST(req: NextRequest) {
  if (!rateLimitLocal(getIp(req), 'cpf-lookup', 8, 60_000)) return tooManyRequests()

  const { cpf } = await req.json() as { cpf?: string }
  const cpfLimpo = cpf?.replace(/\D/g, '') ?? ''
  if (cpfLimpo.length !== 11 || !cpfValido(cpfLimpo)) return NextResponse.json({ found: false })

  const cliente = await buscarClientePorCpf(cpfLimpo)
  if (!cliente || (!cliente.phone && !cliente.email)) return NextResponse.json({ found: false })

  return NextResponse.json({
    found:             true,
    telefoneMascarado: cliente.phone ? maskPhone(cliente.phone) : null,
    emailMascarado:    cliente.email ? maskEmail(cliente.email) : null,
  })
}
