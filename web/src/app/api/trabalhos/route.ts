// GET /api/trabalhos — convites pendentes e trabalhos ativos do usuário logado
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()

  const { data: staff } = await admin
    .from('event_staff')
    .select(`
      id, status, created_at,
      events:event_id (
        id, title, date_start, venue_name, city, state, banner_url
      ),
      event_positions:event_position_id (
        id, name,
        event_position_permissions ( permission )
      ),
      convidado_por:invited_by ( full_name )
    `)
    .eq('user_id', user.id)
    .in('status', ['pending', 'active'])
    .order('created_at', { ascending: false })

  return NextResponse.json({ staff: staff ?? [] })
}
