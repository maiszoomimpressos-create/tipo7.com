import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isEventOwner } from '@/lib/eventPermissions'

// GET — lista os eventos filhos deste evento
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
  const { data: filhos } = await admin
    .from('events')
    .select('id, title, status, date_start, created_at')
    .eq('parent_event_id', id)
    .order('created_at')

  return NextResponse.json({ filhos: filhos ?? [] })
}

// POST /api/eventos/[id]/criar-filho
// Cria um "evento dentro do evento" — mesma organização do pai, ingresso/caixa/status próprios.
// Só permite um nível de aninhamento (o pai não pode já ser filho de outro evento).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!(await isEventOwner(user.id, id))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createServiceClient()

  const { data: pai } = await admin
    .from('events')
    .select(`
      id, organization_id, parent_event_id,
      date_start, date_end,
      venue_name, venue_id, city, state, street, street_number, neighborhood, complement, zip_code, capacity
    `)
    .eq('id', id)
    .single()

  if (!pai) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  if (pai.parent_event_id) {
    return NextResponse.json({ error: 'Este evento já é um evento filho — não é possível criar um filho dele.' }, { status: 400 })
  }

  const body = await req.json() as {
    titulo:                     string
    moduloIngressos?:           boolean
    moduloEstacionamento?:      boolean
    moduloTenda?:               boolean
    permitirVendaNoCaixaPai?:   boolean
  }

  if (!body.titulo?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

  const herdaDadosDoPai = body.moduloTenda || body.moduloEstacionamento

  const { data: filho, error } = await admin
    .from('events')
    .insert({
      organization_id:       pai.organization_id, // sempre do pai, nunca do cliente
      parent_event_id:       pai.id,
      title:                 body.titulo.trim(),
      status:                'rascunho',
      created_by:            user.id,
      modulo_ingressos:      body.moduloIngressos      ?? true,
      modulo_estacionamento: body.moduloEstacionamento  ?? false,
      modulo_tenda:          body.moduloTenda           ?? false,
      permitir_venda_no_caixa_pai: body.permitirVendaNoCaixaPai ?? true,
      // Tenda/Estacionamento herdam data e local do pai (editável depois) —
      // evita redigitar o que já existe; datas específicas de dias são
      // escolhidas depois na etapa de ingressos, a partir do calendário do pai.
      ...(herdaDadosDoPai ? {
        date_start:     pai.date_start,
        date_end:       pai.date_end,
        venue_name:     pai.venue_name,
        venue_id:       pai.venue_id,
        city:           pai.city,
        state:          pai.state,
        street:         pai.street,
        street_number:  pai.street_number,
        neighborhood:   pai.neighborhood,
        complement:     pai.complement,
        zip_code:       pai.zip_code,
        capacity:       pai.capacity,
      } : {}),
    })
    .select('id')
    .single()

  if (error || !filho) return NextResponse.json({ error: 'Erro ao criar evento filho' }, { status: 500 })

  return NextResponse.json({ ok: true, id: filho.id })
}
