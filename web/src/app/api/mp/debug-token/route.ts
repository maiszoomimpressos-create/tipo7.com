// GET /api/mp/debug-token?eventoId=xxx
// Diagnóstico: mostra o token MP do promotor dono do evento.
// Remover após diagnóstico.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const admin    = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const eventoId = req.nextUrl.searchParams.get('eventoId')

  let ownerId = user.id
  let ownerSource = 'usuario_logado'

  // Se passar eventoId, busca o dono real do evento
  if (eventoId) {
    const { data: evento } = await admin.from('events').select('organization_id').eq('id', eventoId).single()
    const { data: org }    = evento
      ? await admin.from('organizations').select('owner_id').eq('id', evento.organization_id).single()
      : { data: null }
    if (org?.owner_id) {
      ownerId     = org.owner_id
      ownerSource = `dono_do_evento (${eventoId})`
    }
  }

  const { data: account } = await admin
    .from('promotor_mp_accounts')
    .select('mp_access_token, mp_user_id, expires_at, updated_at')
    .eq('user_id', ownerId)
    .single()

  if (!account) {
    return NextResponse.json({
      owner_id:     ownerId,
      owner_source: ownerSource,
      erro: 'Nenhuma conta MP conectada para este usuário. O promotor precisa conectar a conta MP em /configuracoes/contas',
    })
  }

  const token   = account.mp_access_token as string
  const prefixo = token?.slice(0, 25) ?? '(vazio)'
  const tipo    = token?.startsWith('TEST-')    ? '🔴 SANDBOX — QR não pode ser pago com dinheiro real'
                : token?.startsWith('APP_USR-') ? '🟢 PRODUÇÃO — formato correto'
                : '⚠️ Formato desconhecido'

  // Consulta MP para validar o token
  let mpUser: Record<string, unknown> | null = null
  let mpErro = null
  try {
    const res = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    mpUser = await res.json()
  } catch (e) {
    mpErro = String(e)
  }

  return NextResponse.json({
    owner_id:      ownerId,
    owner_source:  ownerSource,
    tipo_token:    tipo,
    prefixo_token: prefixo,
    token_expira:  account.expires_at,
    mp_account: {
      id:           mpUser?.id,
      email:        mpUser?.email,
      site_id:      mpUser?.site_id,
      account_type: mpUser?.account_type,
      status:       mpUser?.status,
      error:        mpUser?.error,
      message:      mpUser?.message,
    },
    mp_erro: mpErro,
  })
}
