import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { validarCNPJ } from '@/lib/documentValidation'

type OrgRow = {
  id: string; name: string; cnpj: string | null; nome_fantasia: string | null
  codigo: string | null; logo_url: string | null
  city: string | null; state: string | null; street: string | null
  street_number: string | null; neighborhood: string | null
  zip_code: string | null; complement: string | null; phone: string | null
  nicho: string | null; capacity: number | null
}

// GET /api/organizations — organizações que o usuário administra (dono
// integral ou sócio) ou foi convidado pra administrar (status='convidado')
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()
  const { data: rows } = await admin
    .from('organization_admins')
    .select(`
      role, participacao, percentual, status, organization_id,
      organizations (id, name, cnpj, nome_fantasia, codigo, logo_url,
        city, state, street, street_number, neighborhood, zip_code, complement, phone, nicho, capacity)
    `)
    .eq('user_id', user.id)
    .neq('status', 'removido')
    .order('created_at')

  const organizacoes = (rows ?? []).flatMap(r => {
    const org = (Array.isArray(r.organizations) ? r.organizations[0] : r.organizations) as OrgRow | null
    if (!org) return []
    return [{
      ...org,
      role:         r.role,
      participacao: r.participacao as 'integral' | 'socio',
      percentual:   r.percentual as number | null,
      status:       r.status as 'ativo' | 'convidado',
    }]
  })

  return NextResponse.json({ organizacoes })
}

// POST /api/organizations — cria uma nova organização (ex: mais uma casa
// de show com CNPJ próprio, mesmo com marca repetida entre cidades).
// Documento único (CPF ou CNPJ) — o tamanho já diz qual é, sem perguntar
// PF/PJ. Sem documento válido, a organização segue sem CNPJ (informal).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as {
    documento?:     string
    razaoSocial?:   string
    nomeFantasia?:  string
    logoUrl?:       string | null
    zipCode?:       string
    street?:        string
    streetNumber?:  string
    neighborhood?:  string
    city?:          string
    state?:         string
    complement?:    string
    phone?:         string
    nicho?:         'eventos' | 'estacionamento' | 'ambos'
  }

  const digitos = (body.documento ?? '').replace(/\D/g, '')
  let cnpj: string | null = null
  if (digitos.length === 14) {
    if (!validarCNPJ(digitos)) return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
    cnpj = digitos
  } else if (digitos.length !== 0 && digitos.length !== 11) {
    return NextResponse.json({ error: 'Documento deve ter 11 dígitos (CPF) ou 14 (CNPJ)' }, { status: 400 })
  }

  const nome = body.razaoSocial?.trim() || body.nomeFantasia?.trim()
  if (!nome) return NextResponse.json({ error: 'Informe um nome' }, { status: 400 })

  const admin = createServiceClient()

  if (cnpj) {
    const { count } = await admin.from('organizations').select('id', { count: 'exact', head: true }).eq('cnpj', cnpj)
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'Este CNPJ já está cadastrado por outra organização.' }, { status: 409 })
  }

  const { data: codigo } = await admin.rpc('generate_org_code', { p_tipo: 'promotora' })
  if (!codigo) return NextResponse.json({ error: 'Erro ao gerar código' }, { status: 500 })

  const { data: org, error: errOrg } = await admin
    .from('organizations')
    .insert({
      owner_id:       user.id,
      type:           'promotora',
      codigo,
      name:           nome,
      cnpj,
      nome_fantasia:  body.nomeFantasia?.trim()  || null,
      logo_url:       body.logoUrl               || null,
      zip_code:       body.zipCode               || null,
      street:         body.street                || null,
      street_number:  body.streetNumber          || null,
      neighborhood:   body.neighborhood          || null,
      city:           body.city                  || null,
      state:          body.state                 || null,
      complement:     body.complement            || null,
      phone:          body.phone                 || null,
      nicho:          body.nicho                 || null,
    })
    .select('*')
    .single()

  if (errOrg || !org) return NextResponse.json({ error: 'Erro ao criar organização' }, { status: 500 })

  await admin.from('organization_admins').insert({
    organization_id: org.id,
    user_id:          user.id,
    role:              'admin',
    status:            'ativo',
    participacao:      'integral',
    percentual:        100,
    invited_by:        null,
  })

  return NextResponse.json({
    organizacao: { ...org, role: 'admin', participacao: 'integral', percentual: 100, status: 'ativo' },
  })
}
