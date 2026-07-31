import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isOrgAdmin } from '@/lib/orgAdmin'

// GET /api/organizations/[id]/socios — quem administra essa organização
// hoje (integral/sócio, ativo/convidado)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()
  if (!(await isOrgAdmin(admin, id, user.id))) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { data: rows } = await admin
    .from('organization_admins')
    .select('id, user_id, role, participacao, percentual, status, profiles(full_name, user_code)')
    .eq('organization_id', id)
    .neq('status', 'removido')
    .order('created_at')

  const socios = (rows ?? []).map(r => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    return {
      id:           r.id,
      userId:       r.user_id,
      role:         r.role,
      participacao: r.participacao,
      percentual:   r.percentual as number | null,
      status:       r.status,
      nome:         (p as { full_name: string | null } | null)?.full_name ?? null,
      codigo:       (p as { user_code: string | null } | null)?.user_code ?? null,
    }
  })

  return NextResponse.json({ socios })
}

// POST /api/organizations/[id]/socios — convida alguém pra administrar
// essa organização, identificado por CPF, código T7 pessoal ou e-mail.
// Fica como status='convidado' até a pessoa aceitar (rota /socios/responder).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()
  if (!(await isOrgAdmin(admin, id, user.id))) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json() as { identificador?: string; participacao?: 'integral' | 'socio'; percentual?: number }
  const identificador = body.identificador?.trim() ?? ''
  const participacao  = body.participacao === 'integral' ? 'integral' : 'socio'
  if (!identificador) return NextResponse.json({ error: 'Informe o CPF, código T7 ou e-mail da pessoa' }, { status: 400 })

  // Proprietário integral é sempre 100% por definição — só sócio precisa
  // informar a fatia, e ela precisa ser um número válido entre 0 e 100.
  let percentual: number
  if (participacao === 'integral') {
    percentual = 100
  } else {
    percentual = Number(body.percentual)
    if (!Number.isFinite(percentual) || percentual <= 0 || percentual > 100) {
      return NextResponse.json({ error: 'Informe a porcentagem de participação do sócio (entre 0 e 100).' }, { status: 400 })
    }
  }

  let pessoa: { id: string; full_name: string | null } | null = null

  if (identificador.includes('@')) {
    const { data: userId } = await admin.rpc('get_user_id_by_email', { p_email: identificador })
    if (userId) {
      const { data } = await admin.from('profiles').select('id, full_name').eq('id', userId as string).maybeSingle()
      pessoa = data
    }
  } else {
    const cpfDigitos = identificador.replace(/\D/g, '')
    let query = admin.from('profiles').select('id, full_name')
    query = cpfDigitos.length === 11
      ? query.eq('cpf', cpfDigitos)
      : query.ilike('user_code', identificador)
    const { data } = await query.maybeSingle()
    pessoa = data
  }

  if (!pessoa) return NextResponse.json({ error: 'Pessoa não encontrada com esse CPF/código/e-mail.' }, { status: 404 })
  if (pessoa.id === user.id) return NextResponse.json({ error: 'Você já administra essa organização.' }, { status: 409 })

  const { data: existente } = await admin
    .from('organization_admins')
    .select('id, status')
    .eq('organization_id', id)
    .eq('user_id', pessoa.id)
    .maybeSingle()

  if (existente && existente.status !== 'removido') {
    return NextResponse.json({
      error: existente.status === 'ativo' ? 'Essa pessoa já administra essa organização.' : 'Essa pessoa já tem um convite pendente.',
    }, { status: 409 })
  }

  if (existente) {
    await admin.from('organization_admins')
      .update({ status: 'convidado', participacao, percentual, invited_by: user.id, role: 'admin' })
      .eq('id', existente.id)
  } else {
    await admin.from('organization_admins').insert({
      organization_id: id,
      user_id:          pessoa.id,
      role:             'admin',
      status:           'convidado',
      participacao,
      percentual,
      invited_by:       user.id,
    })
  }

  return NextResponse.json({ ok: true, nome: pessoa.full_name })
}
