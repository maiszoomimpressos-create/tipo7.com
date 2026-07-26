import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buscarVeiculoPorPlaca } from '@/lib/autosave'
import { rateLimit, getIp, tooManyRequests } from '@/lib/rateLimit'

// GET /api/estacionamento/placa-lookup?placa=ABC1234
// Consulta a Autosave pra pré-preencher modelo/cor na entrada do
// estacionamento. Só exige estar autenticado (não é dado sensível do
// evento) — qualquer erro/instabilidade da Autosave vira { found: false },
// nunca um 500, pra não travar o atendente digitando a placa.
export async function GET(req: NextRequest) {
  if (!(await rateLimit(getIp(req), 'estacionamento-placa-lookup', 60, 60_000))) return tooManyRequests()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const placa = req.nextUrl.searchParams.get('placa')?.trim()
  if (!placa) return NextResponse.json({ error: 'Placa não informada' }, { status: 400 })

  const veiculo = await buscarVeiculoPorPlaca(placa)
  if (!veiculo) return NextResponse.json({ found: false })

  return NextResponse.json({ found: true, modelo: veiculo.modelo, cor: veiculo.cor })
}
