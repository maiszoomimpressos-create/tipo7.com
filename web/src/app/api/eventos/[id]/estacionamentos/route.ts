import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isEventOwner } from '@/lib/eventPermissions'

// GET — lista os estacionamentos configurados no evento
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!(await isEventOwner(user.id, id))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createServiceClient()
  const { data: estacionamentos } = await admin
    .from('estacionamentos')
    .select('*')
    .eq('event_id', id)
    .order('created_at')

  return NextResponse.json({ estacionamentos: estacionamentos ?? [] })
}

// POST — cria um novo estacionamento (lote/local) no evento
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!(await isEventOwner(user.id, id))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as {
    nome:                  string
    cobraModo:             'gratis' | 'fixo' | 'por_tempo'
    precoFixo?:            number | null
    precoPrimeiraHora?:    number | null
    precoHoraAdicional?:   number | null
    tetoDiario?:           number | null
    toleranciaMinutos?:    number
    controlaSaida?:        boolean
    vagasTotais?:          number | null
  }

  if (!body.nome?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  if (!['gratis', 'fixo', 'por_tempo'].includes(body.cobraModo)) {
    return NextResponse.json({ error: 'Modo de cobrança inválido' }, { status: 400 })
  }

  const admin = createServiceClient()

  // Nomes únicos entre estacionamentos ativos do mesmo evento (mesmo padrão de caixas)
  const { data: existentes } = await admin
    .from('estacionamentos')
    .select('nome')
    .eq('event_id', id)
    .eq('ativo', true)
  if ((existentes ?? []).some(e => e.nome === body.nome.trim())) {
    return NextResponse.json({ error: `Já existe um estacionamento chamado "${body.nome.trim()}".` }, { status: 400 })
  }

  const { data: criado, error } = await admin
    .from('estacionamentos')
    .insert({
      event_id:              id,
      nome:                  body.nome.trim(),
      cobra_modo:            body.cobraModo,
      preco_fixo:            body.precoFixo            ?? null,
      preco_primeira_hora:   body.precoPrimeiraHora     ?? null,
      preco_hora_adicional:  body.precoHoraAdicional    ?? null,
      teto_diario:           body.tetoDiario            ?? null,
      tolerancia_minutos:    body.toleranciaMinutos     ?? 10,
      controla_saida:        body.controlaSaida         ?? true,
      vagas_totais:          body.vagasTotais           ?? null,
      created_by:            user.id,
    })
    .select()
    .single()

  if (error || !criado) return NextResponse.json({ error: 'Erro ao criar estacionamento' }, { status: 500 })

  return NextResponse.json({ ok: true, estacionamento: criado })
}
