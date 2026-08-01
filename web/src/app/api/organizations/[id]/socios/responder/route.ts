import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/organizations/[id]/socios/responder — o próprio convidado
// aceita ou recusa administrar essa organização (nunca quem convidou).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as { aceitar?: boolean }

  const admin = createServiceClient()
  const { data: convite } = await admin
    .from('organization_admins')
    .select('id, percentual')
    .eq('organization_id', id)
    .eq('user_id', user.id)
    .eq('status', 'convidado')
    .maybeSingle()

  if (!convite) return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 })

  if (body.aceitar) {
    await admin.from('organization_admins').update({ status: 'ativo' }).eq('id', convite.id)

    // Diluição automática: se a organização tinha um único proprietário
    // integral (100%) e agora entra um sócio com X%, o dono deixa de ser
    // "integral" e passa a deter o que sobrou (100 - X%) — nunca fica
    // maior que 100% somado. Só mexe nesse caso simples (1 outro admin
    // integral); se já existe mais de um sócio, não tenta adivinhar a
    // redistribuição sozinho.
    const percentualNovoSocio = Number(convite.percentual ?? 0)
    if (percentualNovoSocio > 0) {
      const { data: outrosAdmins } = await admin
        .from('organization_admins')
        .select('id, participacao, percentual')
        .eq('organization_id', id)
        .eq('status', 'ativo')
        .neq('id', convite.id)

      const integrais = (outrosAdmins ?? []).filter(a => a.participacao === 'integral')
      if (integrais.length === 1) {
        const restante = Math.max(0, 100 - percentualNovoSocio)
        await admin.from('organization_admins')
          .update({ participacao: 'socio', percentual: restante })
          .eq('id', integrais[0].id)
      }
    }
  } else {
    await admin.from('organization_admins').update({ status: 'removido' }).eq('id', convite.id)
  }

  return NextResponse.json({ ok: true })
}
