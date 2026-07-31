import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isOrgAdmin } from '@/lib/orgAdmin'
import { validarCNPJ } from '@/lib/documentValidation'

// PUT /api/organizations/[id] — atualiza dados de uma organização já
// existente (razão social, documento, endereço, logo). Documento único
// (CPF ou CNPJ) igual na criação — dá pra tirar o CNPJ (volta a ser
// informal) ou trocar, contanto que não bata com outra organização.
export async function PUT(
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

  if (cnpj) {
    const { count } = await admin
      .from('organizations').select('id', { count: 'exact', head: true })
      .eq('cnpj', cnpj).neq('id', id)
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'Este CNPJ já está cadastrado por outra organização.' }, { status: 409 })
  }

  const { data: org, error } = await admin
    .from('organizations')
    .update({
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
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !org) return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 })

  return NextResponse.json({ organizacao: org })
}
