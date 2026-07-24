import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isEventOwner, hasEventPermission } from '@/lib/eventPermissions'

// POST /api/estacionamento/[eventoId]/abrir-caixa
// Abre um caixa "de estacionamento" reaproveitando a mesma tabela `caixas` usada pela bilheteria.
// body: { nome, fundoInicial, operadorEmailOuCodigo? }
//
// Só o dono do evento (ou quem estiver no comando da operação — ex: líder
// de uma equipe de segurança terceirizada que contratou o módulo) abre e
// designa o caixa — mesmo modelo já usado pra bilheteria. Não é
// autoatendimento: o operador precisa já estar escalado (equipe ativa com
// permissão de estacionamento) antes de alguém abrir um caixa pra ele.
// Fechar/conferir o troco continua podendo ser feito pelo próprio operador
// (ver /api/caixas/fechar) — só a abertura é restrita.
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
    estacionamentoId?:     string
  }

  if (!body.nome?.trim()) return NextResponse.json({ error: 'Nome do caixa é obrigatório' }, { status: 400 })

  const admin = createServiceClient()

  // Se informado, confirma que o estacionamento pertence a este evento —
  // relevante quando há mais de um local, pra saber qual caixa é de qual.
  let estacionamentoId: string | null = null
  if (body.estacionamentoId) {
    const { data: est } = await admin
      .from('estacionamentos')
      .select('id')
      .eq('id', body.estacionamentoId)
      .eq('event_id', eventoId)
      .maybeSingle()
    if (!est) return NextResponse.json({ error: 'Estacionamento não encontrado neste evento' }, { status: 404 })
    estacionamentoId = body.estacionamentoId
  }

  const { data: abertos } = await admin
    .from('caixas')
    .select('nome, operador_id')
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
      const { data: id } = await admin.rpc('find_user_id_by_email', { p_email: busca })
      operadorId = (id as string | null) ?? null
    }
    if (!operadorId) {
      return NextResponse.json({ error: 'Operador não encontrado. Verifique o email ou código T7-USR.' }, { status: 404 })
    }
    if (!(await hasEventPermission(operadorId, eventoId, ['estacionamento_entrada', 'estacionamento_saida']))) {
      return NextResponse.json(
        { error: 'Esse usuário ainda não é equipe ativa com permissão de estacionamento neste evento. Convide-o primeiro pela equipe do evento.' },
        { status: 400 }
      )
    }
  }

  if (operadorId && (abertos ?? []).some(c => c.operador_id === operadorId)) {
    return NextResponse.json({ error: 'Esse operador já tem um caixa aberto neste evento.' }, { status: 400 })
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
      estacionamento_id:  estacionamentoId,
    })
    .select()
    .single()

  if (error || !caixa) return NextResponse.json({ error: 'Erro ao abrir caixa' }, { status: 500 })

  return NextResponse.json({ ok: true, caixa })
}
