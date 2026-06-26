import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/stats
// Retorna contadores públicos da plataforma (sem dados pessoais)
export async function GET() {
  const admin = createServiceClient()
  const now   = new Date().toISOString()

  const [ativos, realizados, usuarios] = await Promise.all([
    // Eventos publicados com data de fim no futuro (ainda acontecendo ou por vir)
    admin
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'publicado')
      .gte('date_end', now),

    // Eventos publicados ou encerrados cujo fim já passou
    admin
      .from('events')
      .select('id', { count: 'exact', head: true })
      .in('status', ['publicado', 'encerrado'])
      .lt('date_end', now),

    // Total de perfis cadastrados
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true }),
  ])

  return NextResponse.json({
    ativos:     ativos.count     ?? 0,
    realizados: realizados.count ?? 0,
    usuarios:   usuarios.count   ?? 0,
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
