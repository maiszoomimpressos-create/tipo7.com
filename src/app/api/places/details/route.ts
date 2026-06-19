import { NextRequest, NextResponse } from 'next/server'

// GET /api/places/details?place_id=ChIJ...
// Retorna endereço completo de um local do Google Places
export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('place_id')?.trim()
  if (!placeId) return NextResponse.json({ error: 'place_id obrigatório' }, { status: 400 })

  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) return NextResponse.json({ error: 'API key não configurada' }, { status: 500 })

  const fields = 'addressComponents,formattedAddress,location'
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?languageCode=pt-BR`,
    {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': fields,
      },
    }
  )

  if (!res.ok) return NextResponse.json({ error: 'Erro ao buscar detalhes' }, { status: 502 })

  const data = await res.json()
  const comps: { types: string[]; longText: string; shortText: string }[] = data.addressComponents ?? []

  const get = (type: string) => comps.find(c => c.types.includes(type))?.longText ?? ''
  const getShort = (type: string) => comps.find(c => c.types.includes(type))?.shortText ?? ''

  return NextResponse.json({
    cep:    get('postal_code').replace(/\D/g, ''),
    rua:    get('route') || get('street_address'),
    numero: get('street_number'),
    bairro: get('sublocality_level_1') || get('sublocality') || get('neighborhood'),
    cidade: get('administrative_area_level_2') || get('locality'),
    estado: getShort('administrative_area_level_1'),
    enderecoCompleto: data.formattedAddress ?? '',
  })
}
