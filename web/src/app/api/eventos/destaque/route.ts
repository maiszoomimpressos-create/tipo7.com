// Rota de API — busca eventos em destaque para o carrossel
// GET /api/eventos/destaque?lat=-25.73&lng=-53.06  (preferencial — distância real)
// GET /api/eventos/destaque?estado=PR              (fallback — sem coordenada do usuário)
// Sem nenhum dos dois, retorna os mais próximos da data de qualquer lugar
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

// Quando há lat/lng do usuário, busca um pool maior (ordenado por data) pra
// ter chance real de achar os mais próximos por distância, e não só os
// mais próximos dentre os 100 primeiros por data.
const FETCH_MAX_DISTANCIA = 500

// Teto de segurança — nunca busca mais longe que isso só pra completar a
// lista de 100. Eventos sem coordenada geocodificada ainda entram como
// preenchimento (não desaparecem do carrossel por falta de geocode).
const RAIO_TETO_KM = 500

const COLUNAS = 'id, title, description, date_start, city, state, banner_url, status, lat, lng'

function limiteSuperior() {
  const d = new Date()
  d.setMonth(d.getMonth() + JANELA_MESES)
  return d.toISOString()
}

// Distância em linha reta entre duas coordenadas (fórmula de Haversine), em km
function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const toRad = (g: number) => (g * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET(request: NextRequest) {
  const estado   = request.nextUrl.searchParams.get('estado')
  const latParam = request.nextUrl.searchParams.get('lat')
  const lngParam = request.nextUrl.searchParams.get('lng')
  const lat = latParam ? parseFloat(latParam) : null
  const lng = lngParam ? parseFloat(lngParam) : null
  const temCoordenadaUsuario = lat != null && lng != null && !isNaN(lat) && !isNaN(lng)

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

  // ── Filtro por proximidade real (lat/lng do usuário) — prioridade máxima.
  // Exclui eventos filhos (Tenda): eles não são destaque próprio, só são
  // descobertos através da página do evento pai (aba de Programação).
  //
  // TODO (próxima versão): dar pra promotor "comprar" exposição nesse
  // carrossel principal — um botão de vender destaque pago. Não implementar
  // ainda, só deixar registrado aqui pra retomar depois.
  if (temCoordenadaUsuario) {
    const { data: pool } = await supabase
      .from('events')
      .select(COLUNAS)
      .eq('status', 'publicado')
      .is('parent_event_id', null)
      .gte('date_start', new Date().toISOString())
      .lte('date_start', limiteSuperior())
      .order('date_start', { ascending: true })
      .limit(FETCH_MAX_DISTANCIA)

    if (pool && pool.length > 0) {
      const comDistancia = pool.map(evento => ({
        evento,
        distancia: (evento.lat != null && evento.lng != null)
          ? distanciaKm(lat as number, lng as number, evento.lat, evento.lng)
          : null,
      }))

      // Mais próximos primeiro; sem coordenada geocodificada entra por
      // último, como preenchimento (evento sem CEP resolvido na criação
      // não pode simplesmente sumir do carrossel)
      comDistancia.sort((a, b) => {
        if (a.distancia == null && b.distancia == null) return 0
        if (a.distancia == null) return 1
        if (b.distancia == null) return -1
        return a.distancia - b.distancia
      })

      const dentroDoTeto = comDistancia.filter(x => x.distancia == null || x.distancia <= RAIO_TETO_KM)
      const selecionados = (dentroDoTeto.length > 0 ? dentroDoTeto : comDistancia).slice(0, POOL_MAX)

      return NextResponse.json({
        eventos:  normalizar(selecionados.map(x => x.evento)),
        banners:  banners ?? [],
        filtrado: true,
        estado:   null,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      })
    }
    // Nenhum evento publicado no país inteiro — cai no geral abaixo (vazio mesmo, igual hoje)
  }

  // ── Fallback por estado (UF) — pra quem não mandou lat/lng (ex: cidade
  // escolhida manualmente, sem GPS, ou localStorage salvo antes dessa
  // mudança) ──
  const query = supabase
    .from('events')
    .select(COLUNAS)
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
      .select(COLUNAS)
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
