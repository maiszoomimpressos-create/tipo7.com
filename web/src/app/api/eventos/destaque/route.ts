// Rota de API — busca eventos em destaque para o carrossel
// GET /api/eventos/destaque?estado=PR
// Se não passar estado, retorna os mais próximos da data de qualquer lugar
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Cliente com service role para leitura sem RLS (endpoint interno)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Janela de elegibilidade: evento entra na roda a partir de 2 meses antes de
// acontecer. Pool grande (até 100) ordenado por data — o carrossel do
// cliente já anda 1 item por vez a cada 5s e volta pro início sozinho
// (ver Carousel.tsx), então não precisa de sorteio nem de lógica de
// "expulsar" o mais distante: o próprio LIMIT + ORDER BY já garante isso.
const JANELA_MESES = 2
const POOL_MAX      = 100

function limiteSuperior() {
  const d = new Date()
  d.setMonth(d.getMonth() + JANELA_MESES)
  return d.toISOString()
}

export async function GET(request: NextRequest) {
  // Região = estado (UF), não cidade exata — evento não tem coordenada
  // salva pra dar pra fazer raio geográfico de verdade hoje, então usar o
  // estado é o proxy mais simples que já funciona com o dado que existe.
  const estado = request.nextUrl.searchParams.get('estado')

  // Normaliza o resultado — a coluna no banco é banner_url, o carrossel espera cover_url
  const normalizar = (rows: { banner_url?: string | null; [key: string]: unknown }[]) =>
    rows.map(({ banner_url, ...rest }) => ({ ...rest, cover_url: banner_url ?? null }))

  // Banners promocionais do sistema (divulgação da própria plataforma) —
  // entram no giro do carrossel junto com os eventos, cadastrados em
  // Admin → Marketing
  const { data: banners } = await supabase
    .from('system_banners')
    .select('id, image_url')
    .eq('active', true)
    .order('order_index')

  // Monta a query base — só eventos publicados e futuros
  // Exclui eventos filhos (Tenda): eles não são destaque próprio, só são
  // descobertos através da página do evento pai (aba de Programação).
  //
  // TODO (próxima versão): dar pra promotor "comprar" exposição nesse
  // carrossel principal — um botão de vender destaque pago. Não implementar
  // ainda, só deixar registrado aqui pra retomar depois.
  const query = supabase
    .from('events')
    .select('id, title, description, date_start, city, state, banner_url, status')
    .eq('status', 'publicado')
    .is('parent_event_id', null)
    .gte('date_start', new Date().toISOString())
    .lte('date_start', limiteSuperior())
    .order('date_start', { ascending: true })
    .limit(POOL_MAX)

  // Se tiver estado detectado, filtra por ele
  // Se não encontrar eventos no estado, retorna os destaques gerais
  if (estado) {
    const { data: eventosEstado } = await supabase
      .from('events')
      .select('id, title, description, date_start, city, state, banner_url, status')
      .eq('status', 'publicado')
      .is('parent_event_id', null)
      .eq('state', estado)
      .gte('date_start', new Date().toISOString())
      .lte('date_start', limiteSuperior())
      .order('date_start', { ascending: true })
      .limit(POOL_MAX)

    // Se encontrou eventos no estado, retorna eles
    if (eventosEstado && eventosEstado.length > 0) {
      return NextResponse.json({ eventos: normalizar(eventosEstado), banners: banners ?? [], filtrado: true, estado }, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      })
    }
    // Senão, cai no geral abaixo
  }

  // Retorna destaques gerais (sem filtro de região)
  const { data: eventos, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ eventos: normalizar(eventos ?? []), banners: banners ?? [], filtrado: false, estado: null }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  })
}
