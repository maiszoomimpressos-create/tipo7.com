import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/places/autocomplete?q=allianz
// Retorna sugestões de locais do Google Places (chave fica segura no servidor)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ suggestions: [] })

  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) return NextResponse.json({ error: 'API key não configurada' }, { status: 500 })

  const url = new URL('https://places.googleapis.com/v1/places:autocomplete')
  const body = {
    input: q,
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

  if (!res.ok) return NextResponse.json({ suggestions: [] })

  const data = await res.json()
  const suggestions = (data.suggestions ?? []).map((s: {
    placePrediction?: { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } }
  }) => ({
    placeId:       s.placePrediction?.placeId ?? '',
    texto:         s.placePrediction?.text?.text ?? '',
    nomePrincipal: s.placePrediction?.structuredFormat?.mainText?.text ?? '',
    nomeSecundario: s.placePrediction?.structuredFormat?.secondaryText?.text ?? '',
  }))

  return NextResponse.json({ suggestions })
}
