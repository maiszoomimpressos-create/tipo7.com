import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isEventOwner } from '@/lib/eventPermissions'

// PATCH — edita um estacionamento existente
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; estacionamentoId: string }> }
) {
  const { id, estacionamentoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!(await isEventOwner(user.id, id))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as {
    nome?:                  string
    cobraModo?:             'gratis' | 'fixo' | 'por_tempo'
    precoFixo?:             number | null
    precoPrimeiraHora?:     number | null
    precoHoraAdicional?:    number | null
    tetoDiario?:            number | null
    toleranciaMinutos?:     number
    controlaSaida?:         boolean
    vagasTotais?:           number | null
    ativo?:                 boolean
  }

  const admin = createServiceClient()

  const updates: Record<string, unknown> = {}
  if (body.nome !== undefined)                updates.nome                 = body.nome.trim()
  if (body.cobraModo !== undefined)            updates.cobra_modo           = body.cobraModo
  if (body.precoFixo !== undefined)            updates.preco_fixo           = body.precoFixo
  if (body.precoPrimeiraHora !== undefined)    updates.preco_primeira_hora  = body.precoPrimeiraHora
  if (body.precoHoraAdicional !== undefined)   updates.preco_hora_adicional = body.precoHoraAdicional
  if (body.tetoDiario !== undefined)           updates.teto_diario          = body.tetoDiario
  if (body.toleranciaMinutos !== undefined)    updates.tolerancia_minutos   = body.toleranciaMinutos
  if (body.controlaSaida !== undefined)        updates.controla_saida       = body.controlaSaida
  if (body.vagasTotais !== undefined)          updates.vagas_totais         = body.vagasTotais
  if (body.ativo !== undefined)                updates.ativo                = body.ativo

  const { error } = await admin
    .from('estacionamentos')
    .update(updates)
    .eq('id', estacionamentoId)
    .eq('event_id', id)

  if (error) return NextResponse.json({ error: 'Erro ao atualizar estacionamento' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — remove um estacionamento (bloqueado se ainda tiver sessão em aberto)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; estacionamentoId: string }> }
) {
  const { id, estacionamentoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!(await isEventOwner(user.id, id))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createServiceClient()

  const { data: aberta } = await admin
    .from('estacionamento_sessoes')
    .select('id')
    .eq('estacionamento_id', estacionamentoId)
    .eq('status', 'aberto')
    .limit(1)
    .maybeSingle()

  if (aberta) {
    return NextResponse.json({ error: 'Existe veículo com sessão em aberto neste estacionamento.' }, { status: 400 })
  }

  const { error } = await admin
    .from('estacionamentos')
    .delete()
    .eq('id', estacionamentoId)
    .eq('event_id', id)

  if (error) return NextResponse.json({ error: 'Erro ao excluir estacionamento' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
