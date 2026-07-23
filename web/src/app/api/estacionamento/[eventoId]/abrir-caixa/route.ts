import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isEventOwner } from '@/lib/eventPermissions'

// POST /api/estacionamento/[eventoId]/abrir-caixa
// Abre um caixa "de estacionamento" reaproveitando a mesma tabela `caixas` usada pela bilheteria.
// body: { nome, fundoInicial, operadorEmailOuCodigo? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventoId: string }> }
) {
  const { eventoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!(await isEventOwner(user.id, eventoId))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json() as {
    nome:                  string
    fundoInicial:          number
    operadorEmailOuCodigo?: string
  }

  if (!body.nome?.trim()) return NextResponse.json({ error: 'Nome do caixa é obrigatório' }, { status: 400 })

  const admin = createServiceClient()

  const { data: abertos } = await admin
    .from('caixas')
    .select('nome')
    .eq('evento_id', eventoId)
    .eq('status', 'aberto')
  if ((abertos ?? []).some(c => c.nome === body.nome.trim())) {
    return NextResponse.json({ error: `Já existe um caixa aberto chamado "${body.nome.trim()}".` }, { status: 400 })
  }

  let operadorId: string | null = null
  if (body.operadorEmailOuCodigo?.trim()) {
    const busca = body.operadorEmailOuCodigo.trim()
    if (busca.toUpperCase().startsWith('T7-')) {
      const { data: perfil } = await admin.from('profiles').select('id').eq('user_code', busca.toUpperCase()).maybeSingle()
      operadorId = perfil?.id ?? null
    } else {
      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
      operadorId = users.find(u => u.email?.toLowerCase() === busca.toLowerCase())?.id ?? null
    }
    if (!operadorId) {
      return NextResponse.json({ error: 'Operador não encontrado. Verifique o email ou código T7-USR.' }, { status: 404 })
    }

    // Confirma que esse usuário já está ativo como staff com gerenciar_estacionamento neste evento
    const { data: staff } = await admin
      .from('event_staff')
      .select('id, event_positions(event_position_permissions(permission))')
      .eq('event_id', eventoId)
      .eq('user_id', operadorId)
      .eq('status', 'active')
      .maybeSingle()
    const pos = staff?.event_positions as unknown as { event_position_permissions: { permission: string }[] } | null
    const temPermissao = (pos?.event_position_permissions ?? []).some(p => p.permission === 'gerenciar_estacionamento')
    if (!temPermissao) {
      return NextResponse.json(
        { error: 'Esse usuário ainda não é equipe ativa com permissão de estacionamento neste evento. Convide-o primeiro pela equipe do evento.' },
        { status: 400 }
      )
    }
  }

  const { data: caixa, error } = await admin
    .from('caixas')
    .insert({
      evento_id:          eventoId,
      nome:               body.nome.trim(),
      fundo_inicial:      body.fundoInicial ?? 0,
      ingressos_alocados: 0,
      operador_id:        operadorId,
      created_by:         user.id,
    })
    .select()
    .single()

  if (error || !caixa) return NextResponse.json({ error: 'Erro ao abrir caixa' }, { status: 500 })

  return NextResponse.json({ ok: true, caixa })
}
