import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

// Webhook recebido da Autosave — notifica quando um customer é criado ou
// atualizado (inclusive por outro sistema do mesmo grupo, não só o Tipo7),
// pra manter o profile local enriquecido sem precisar de polling.
//
// Regra de reconciliação: só completa campos que estão vazios no profile
// local — nunca sobrescreve o que o usuário já preencheu diretamente aqui,
// mesmo que a Autosave tenha um valor "mais novo".

const CAMPOS_SINCRONIZAVEIS = [
  'full_name', 'cpf', 'phone', 'rg', 'birth_date',
  'zip_code', 'street', 'street_number', 'neighborhood', 'city', 'state', 'complement',
] as const

function assinaturaValida(rawBody: string, assinatura: string | null, segredo: string): boolean {
  if (!assinatura) return false
  const esperada = createHmac('sha256', segredo).update(rawBody).digest('hex')
  if (esperada.length !== assinatura.length) return false
  return timingSafeEqual(Buffer.from(esperada), Buffer.from(assinatura))
}

export async function POST(req: NextRequest) {
  const admin = createServiceClient()
  const { data: integracao } = await admin
    .from('api_integracoes')
    .select('webhook_secret')
    .eq('area_slug', 'usuarios')
    .maybeSingle()
  const segredo = integracao?.webhook_secret
  if (!segredo) return NextResponse.json({ error: 'Webhook não configurado' }, { status: 500 })

  const rawBody    = await req.text()
  const assinatura = req.headers.get('x-autosave-signature')
  if (!assinaturaValida(rawBody, assinatura, segredo)) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody) as {
    event?:    'created' | 'updated'
    resource?: string
    data?:     Record<string, unknown>
  }

  if (payload.resource !== 'customers' || !payload.data) {
    return NextResponse.json({ ok: true })
  }

  const externalId = payload.data.external_id
  if (typeof externalId !== 'string') return NextResponse.json({ ok: true })

  const { data: perfilAtual } = await admin
    .from('profiles')
    .select(CAMPOS_SINCRONIZAVEIS.join(', '))
    .eq('id', externalId)
    .maybeSingle() as { data: Record<string, unknown> | null }

  if (!perfilAtual) return NextResponse.json({ ok: true })

  const atualizacoes: Record<string, unknown> = {}
  for (const campo of CAMPOS_SINCRONIZAVEIS) {
    const valorAtual = perfilAtual[campo]
    const valorNovo  = payload.data[campo]
    if ((valorAtual === null || valorAtual === '') && valorNovo) atualizacoes[campo] = valorNovo
  }

  if (Object.keys(atualizacoes).length > 0) {
    await admin.from('profiles').update(atualizacoes).eq('id', externalId)
  }

  return NextResponse.json({ ok: true })
}
