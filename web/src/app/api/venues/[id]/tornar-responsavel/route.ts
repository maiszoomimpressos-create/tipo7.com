import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface Params { params: Promise<{ id: string }> }

// POST /api/venues/[id]/tornar-responsavel
// Marca o usuário logado como administrador/curador do lugar — não tem
// relação nenhuma com dinheiro ou caixa (isso é sempre do evento/promotor
// que o criou). É só quem cuida dos dados do lugar (endereço, capacidade,
// estacionamento). Gera o código T7-BR-E-xxx na primeira vez que alguém
// assume o lugar, não quando o venue é só um endereço solto do Google Places.
export async function POST(req: NextRequest, { params }: Params) {
  const { id: venueId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()

  const { data: venue, error: errVenue } = await admin
    .from('venues').select('id, codigo').eq('id', venueId).single()
  if (errVenue || !venue) return NextResponse.json({ error: 'Local não encontrado' }, { status: 404 })

  const { error: errAdmin } = await admin
    .from('venue_admins')
    .upsert(
      { venue_id: venueId, user_id: user.id, role: 'admin', status: 'ativo' },
      { onConflict: 'venue_id,user_id' }
    )
  if (errAdmin) return NextResponse.json({ error: 'Erro ao vincular responsável' }, { status: 500 })

  let codigo = venue.codigo
  if (!codigo) {
    const { data: novoCodigo, error: errCodigo } = await admin
      .rpc('generate_org_code', { p_tipo: 'estabelecimento' })
    if (errCodigo || !novoCodigo) return NextResponse.json({ error: 'Erro ao gerar código' }, { status: 500 })
    codigo = novoCodigo
  }

  const body = await req.json().catch(() => ({})) as {
    phone?: string; nicho?: 'eventos' | 'estacionamento' | 'ambos'
    cnpj?: string; nome_fantasia?: string
    capacity?: number; has_parking?: boolean; parking_spots?: number
  }

  const updateData: Record<string, unknown> = { codigo }
  if (body.phone !== undefined)         updateData.phone         = body.phone || null
  if (body.nicho !== undefined)         updateData.nicho         = body.nicho || null
  if (body.cnpj !== undefined)          updateData.cnpj          = body.cnpj ? body.cnpj.replace(/\D/g, '') : null
  if (body.nome_fantasia !== undefined) updateData.nome_fantasia = body.nome_fantasia || null
  if (body.capacity !== undefined)      updateData.capacity      = body.capacity || null
  if (body.has_parking !== undefined)   updateData.has_parking   = body.has_parking
  if (body.parking_spots !== undefined) updateData.parking_spots = body.parking_spots || null

  const { data: venueAtualizado, error: errUpdate } = await admin
    .from('venues').update(updateData).eq('id', venueId).select('*').single()
  if (errUpdate) return NextResponse.json({ error: 'Erro ao atualizar local' }, { status: 500 })

  return NextResponse.json({ venue: venueAtualizado })
}
