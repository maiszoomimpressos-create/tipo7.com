import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/stats
// Retorna contadores públicos via função SECURITY DEFINER (sem service role)
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('stats_publicas')

  if (error) return NextResponse.json({ ativos: 0, realizados: 0, usuarios: 0 })

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
