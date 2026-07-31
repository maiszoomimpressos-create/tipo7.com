import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdminMember } from '@/lib/adminAuth'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const me = await getAdminMember(user.id)
  if (!me || me.role !== 'super_admin') return null
  return me
}

interface Params { params: Promise<{ id: string }> }

// PUT /api/admin/integracoes/rotas/[id]
// Body: { gatilho?, campos_envia?, campos_recebe?, observacao? } — só
// documentação editável. Não muda o que o código realmente envia/pede pra
// Autosave (isso ainda exige mexer em lib/autosave.ts + deploy).
export async function PUT(req: NextRequest, { params }: Params) {
  const me = await requireSuperAdmin()
  if (!me) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const body = await req.json() as {
    gatilho?:       string
    campos_envia?:  string[]
    campos_recebe?: string[]
    observacao?:    string
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.gatilho       !== undefined) updates.gatilho       = body.gatilho.trim() || null
  if (body.campos_envia  !== undefined) updates.campos_envia  = body.campos_envia.map(c => c.trim()).filter(Boolean)
  if (body.campos_recebe !== undefined) updates.campos_recebe = body.campos_recebe.map(c => c.trim()).filter(Boolean)
  if (body.observacao    !== undefined) updates.observacao    = body.observacao.trim() || null

  const admin = createServiceClient()
  const { error } = await admin.from('api_integracao_rotas').update(updates).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
