import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { hasEventPermission } from '@/lib/eventPermissions'
import { rateLimit, getIp, tooManyRequests } from '@/lib/rateLimit'

// POST /api/estacionamento/entrada
// body: { estacionamentoId, placa, nomeCondutor?, telefoneCondutor? }
export async function POST(req: NextRequest) {
  if (!(await rateLimit(getIp(req), 'estacionamento-entrada', 60, 60_000))) return tooManyRequests()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as {
    estacionamentoId: string
    placa:            string
    nomeCondutor?:    string
    telefoneCondutor?: string
  }

  if (!body.estacionamentoId || !body.placa?.trim()) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  const admin = createServiceClient()

  const { data: estacionamento } = await admin
    .from('estacionamentos')
    .select('id, event_id')
    .eq('id', body.estacionamentoId)
    .single()

  if (!estacionamento) return NextResponse.json({ error: 'Estacionamento não encontrado' }, { status: 404 })

  if (!(await hasEventPermission(user.id, estacionamento.event_id, 'gerenciar_estacionamento'))) {
    return NextResponse.json({ error: 'Sem permissão para este evento' }, { status: 403 })
  }

  // Checagem de vagas + inserção acontecem atomicamente dentro da function —
  // trava a linha do estacionamento pra duas entradas simultâneas não furarem o limite.
  const { data: resultado, error: rpcError } = await admin.rpc('registrar_entrada_estacionamento', {
    p_estacionamento_id: body.estacionamentoId,
    p_placa:             body.placa.trim().toUpperCase(),
    p_nome_condutor:     body.nomeCondutor?.trim()     || null,
    p_telefone_condutor: body.telefoneCondutor?.trim() || null,
    p_registrado_por:    user.id,
  })

  if (rpcError) return NextResponse.json({ error: 'Erro ao registrar entrada' }, { status: 500 })

  if (resultado?.error === 'lotado') {
    return NextResponse.json({ error: 'Lotado — não há vagas disponíveis neste estacionamento.' }, { status: 409 })
  }
  if (resultado?.error === 'estacionamento_inativo') {
    return NextResponse.json({ error: 'Estacionamento inativo' }, { status: 400 })
  }
  if (resultado?.error === 'estacionamento_nao_encontrado') {
    return NextResponse.json({ error: 'Estacionamento não encontrado' }, { status: 404 })
  }
  if (!resultado?.sessao_id) {
    return NextResponse.json({ error: 'Erro ao registrar entrada' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sessaoId: resultado.sessao_id })
}
