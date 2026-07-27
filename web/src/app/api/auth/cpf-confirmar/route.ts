// POST /api/auth/cpf-confirmar
// body: { cpf, valor }
// "valor" é o telefone ou email completo que a pessoa digitou pra provar
// que conhece um dado privado do cadastro encontrado (não só o CPF, que
// sozinho não é segredo suficiente). Só libera os dados completos se bater
// exatamente com o telefone OU email guardado na Autosave.
//
// Rate limit via banco (não em memória) porque esse é o endpoint sensível de
// verdade — é literalmente "tentar adivinhar" um dado, então precisa valer
// entre instâncias diferentes da Vercel, não só por processo.
import { NextRequest, NextResponse } from 'next/server'
import { buscarClientePorCpf } from '@/lib/autosave'
import { rateLimit, getIp, tooManyRequests } from '@/lib/rateLimit'

function normalizarTelefone(v: string): string {
  return v.replace(/\D/g, '')
}

function normalizarEmail(v: string): string {
  return v.trim().toLowerCase()
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(getIp(req), 'cpf-confirmar', 5, 5 * 60_000))) return tooManyRequests()

  const { cpf, valor } = await req.json() as { cpf?: string; valor?: string }
  const cpfLimpo = cpf?.replace(/\D/g, '') ?? ''
  if (cpfLimpo.length !== 11 || !valor?.trim()) return NextResponse.json({ ok: false })

  const cliente = await buscarClientePorCpf(cpfLimpo)
  if (!cliente) return NextResponse.json({ ok: false })

  const valorDigitado   = valor.trim()
  const bateTelefone    = !!cliente.phone && normalizarTelefone(valorDigitado) === normalizarTelefone(cliente.phone)
  const bateEmail       = !!cliente.email && normalizarEmail(valorDigitado)    === normalizarEmail(cliente.email)

  if (!bateTelefone && !bateEmail) return NextResponse.json({ ok: false })

  return NextResponse.json({
    ok:    true,
    dados: {
      fullName:     cliente.full_name     || null,
      email:        cliente.email         || null,
      phone:        cliente.phone         || null,
      birthDate:    cliente.birth_date    || null,
      rg:           cliente.rg            || null,
      zipCode:      cliente.zip_code      || null,
      street:       cliente.street        || null,
      streetNumber: cliente.street_number || null,
      neighborhood: cliente.neighborhood  || null,
      city:         cliente.city          || null,
      state:        cliente.state         || null,
      complement:   cliente.complement    || null,
    },
  })
}
