import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isOrgAdmin } from '@/lib/orgAdmin'

// POST /api/caixas/validar
// Segunda etapa do fechamento — só o dono do evento confirma a contagem que
// o operador enviou, finalizando o caixa de verdade. body: { caixaId }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { caixaId } = await req.json() as { caixaId: string }
  if (!caixaId) return NextResponse.json({ error: 'caixaId obrigatório' }, { status: 400 })

  const admin = createServiceClient()

  const { data: caixa } = await admin
    .from('caixas')
    .select('*, events(organization_id)')
    .eq('id', caixaId)
    .single()
  if (!caixa) return NextResponse.json({ error: 'Caixa não encontrado' }, { status: 404 })
  if (caixa.status !== 'fechamento_pendente') {
    return NextResponse.json({ error: 'Este caixa não tem contagem pendente de validação' }, { status: 400 })
  }

  const evento = caixa.events as { organization_id: string } | null
  if (!evento || !(await isOrgAdmin(admin, evento.organization_id, user.id))) {
    return NextResponse.json({ error: 'Só o dono/admin do evento pode validar o fechamento' }, { status: 403 })
  }

  const { data: fechamento } = await admin
    .from('caixa_fechamento')
    .select('id')
    .eq('caixa_id', caixaId)
    .is('validado_por', null)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!fechamento) return NextResponse.json({ error: 'Contagem não encontrada para este caixa' }, { status: 404 })

  const agora = new Date().toISOString()

  const [{ error: errValidacao }, { error: errCaixa }] = await Promise.all([
    admin.from('caixa_fechamento').update({ validado_por: user.id, validado_em: agora }).eq('id', fechamento.id),
    admin.from('caixas').update({ status: 'fechado', fechado_em: agora }).eq('id', caixaId),
  ])

  if (errValidacao) return NextResponse.json({ error: errValidacao.message }, { status: 500 })
  if (errCaixa) return NextResponse.json({ error: errCaixa.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
