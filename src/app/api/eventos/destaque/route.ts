// Rota de API — busca eventos em destaque para o carrossel
// GET /api/eventos/destaque?cidade=São Paulo
// Se não passar cidade, retorna os mais próximos da data de qualquer lugar
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Cliente com service role para leitura sem RLS (endpoint interno)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const cidade = request.nextUrl.searchParams.get('cidade')

  // Normaliza o resultado — a coluna no banco é banner_url, o carrossel espera cover_url
  const normalizar = (rows: { banner_url?: string | null; [key: string]: unknown }[]) =>
    rows.map(({ banner_url, ...rest }) => ({ ...rest, cover_url: banner_url ?? null }))

  // Monta a query base — só eventos publicados e futuros
  let query = supabase
    .from('events')
    .select('id, title, description, date_start, city, state, banner_url, status')
    .eq('status', 'publicado')
    .gte('date_start', new Date().toISOString())
    .order('date_start', { ascending: true })
    .limit(7)

  // Se tiver cidade detectada, filtra por ela
  // Se não encontrar eventos na cidade, retorna os destaques gerais
  if (cidade) {
    const { data: eventosCidade } = await supabase
      .from('events')
      .select('id, title, description, date_start, city, state, banner_url, status')
      .eq('status', 'publicado')
      .ilike('city', `%${cidade}%`) // busca parcial — "São Paulo" encontra "São Paulo - SP"
      .gte('date_start', new Date().toISOString())
      .order('date_start', { ascending: true })
      .limit(7)

    // Se encontrou eventos na cidade, retorna eles
    if (eventosCidade && eventosCidade.length > 0) {
      return NextResponse.json({ eventos: normalizar(eventosCidade), filtrado: true, cidade })
    }
    // Senão, cai no geral abaixo
  }

  // Retorna destaques gerais (sem filtro de cidade)
  const { data: eventos, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ eventos: normalizar(eventos ?? []), filtrado: false, cidade: null })
}
