import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/places/autocomplete?q=allianz
// Retorna sugestões de locais — primeiro os venues já cadastrados na
// plataforma (busca interna, com endereço/capacidade já embutidos, sem
// precisar de uma segunda chamada), depois os resultados do Google Places.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ suggestions: [] })

  const cidade = req.nextUrl.searchParams.get('cidade')?.trim()
  const estado = req.nextUrl.searchParams.get('estado')?.trim()

  // ── Venues já cadastrados na plataforma (busca interna) ──────────────
  let venueQuery = supabase
    .from('venues')
    .select('id, name, street, street_number, neighborhood, city, state, zip_code, complement, lat, lng, capacity, has_parking, parking_spots')
    .ilike('name', `%${q}%`)
    .limit(5)
  if (cidade) venueQuery = venueQuery.ilike('city', `%${cidade}%`)
  const { data: venues } = await venueQuery

  const sugestoesVenue = (venues ?? []).map(v => ({
    origem:         'venue' as const,
    placeId:        '',
    venueId:        v.id,
    nomePrincipal:  v.name,
    nomeSecundario: [v.city, v.state].filter(Boolean).join(' - '),
    zipCode:        v.zip_code ?? '',
    street:         v.street ?? '',
    streetNumber:   v.street_number ?? '',
    neighborhood:   v.neighborhood ?? '',
    city:           v.city ?? '',
    state:          v.state ?? '',
    complement:     v.complement ?? '',
    lat:            v.lat,
    lng:            v.lng,
    capacity:       v.capacity,
    hasParking:     v.has_parking,
    parkingSpots:   v.parking_spots,
  }))

  // ── Google Places (só se a chave estiver configurada) ────────────────
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) return NextResponse.json({ suggestions: sugestoesVenue })

  const input = cidade ? `${q}, ${cidade}${estado ? ' - ' + estado : ''}` : q
  const url = new URL('https://places.googleapis.com/v1/places:autocomplete')
  const body = {
    input,
    languageCode: 'pt-BR',
    regionCode: 'BR',
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) return NextResponse.json({ suggestions: sugestoesVenue })

  const data = await res.json()
  const sugestoesGoogle = (data.suggestions ?? []).map((s: {
    placePrediction?: { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } }
  }) => ({
    origem:         'google' as const,
    placeId:        s.placePrediction?.placeId ?? '',
    texto:          s.placePrediction?.text?.text ?? '',
    nomePrincipal:  s.placePrediction?.structuredFormat?.mainText?.text ?? '',
    nomeSecundario: s.placePrediction?.structuredFormat?.secondaryText?.text ?? '',
  }))

  return NextResponse.json({ suggestions: [...sugestoesVenue, ...sugestoesGoogle] })
}
