// GET /api/eventos/buscar?q=texto&categoria=Festa&cidade=SP&limit=12
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getIp, tooManyRequests } from '@/lib/rateLimit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  if (!rateLimit(getIp(request), 'eventos-buscar', 20, 60_000)) return tooManyRequests()

  const q         = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const categoria = request.nextUrl.searchParams.get('categoria') ?? ''
  const cidade    = request.nextUrl.searchParams.get('cidade') ?? ''
  const limit     = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '12', 10), 48)

  let query = supabase
    .from('events')
    .select('id, title, date_start, city, state, banner_url, category')
    .eq('status', 'publicado')
    .gte('date_start', new Date().toISOString())
    .order('date_start', { ascending: true })
    .limit(limit)

  if (q)         query = query.ilike('title', `%${q}%`)
  if (categoria) query = query.eq('category', categoria)
  if (cidade)    query = query.ilike('city', `%${cidade}%`)

  const { data: eventos, error } = await query

  if (error) {
    console.error('[eventos/buscar]', error.message)
    return NextResponse.json({ error: 'Erro ao buscar eventos.' }, { status: 500 })
  }

  // Preço mínimo por evento
  const ids = (eventos ?? []).map(e => e.id)
  const minPrices: Record<string, number | null> = Object.fromEntries(ids.map(id => [id, null]))

  if (ids.length > 0) {
    const { data: tickets } = await supabase
      .from('event_tickets')
      .select('event_id, price')
      .in('event_id', ids)

    tickets?.forEach(t => {
      const atual = minPrices[t.event_id]
      const preco = Number(t.price)
      if (atual === null || preco < atual) minPrices[t.event_id] = preco
    })
  }

  return NextResponse.json({
    eventos: (eventos ?? []).map(e => ({ ...e, minPrice: minPrices[e.id] ?? null }))
  })
}
