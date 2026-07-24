import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { hasEventPermission, getStaffPortao } from '@/lib/eventPermissions'
import { rateLimit, getIp, tooManyRequests } from '@/lib/rateLimit'

// POST /api/estacionamento/entrada
// body: { estacionamentoId, placa, nomeCondutor?, telefoneCondutor?, formaPagamento?, caixaId?, portaoId? }
// formaPagamento/caixaId só se aplicam (e são exigidos) quando o estacionamento
// é cobra_modo='fixo' — preço fixo cobra sempre na entrada; por_tempo continua
// cobrando só na saída.
// portaoId é exigido só se o estacionamento tiver portões cadastrados.
export async function POST(req: NextRequest) {
  if (!(await rateLimit(getIp(req), 'estacionamento-entrada', 60, 60_000))) return tooManyRequests()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as {
    estacionamentoId: string
    placa:            string
    nomeCondutor?:    string
    telefoneCondutor?: string
    formaPagamento?:  'dinheiro' | 'pix' | 'cartao' | 'cortesia'
    caixaId?:         string
    portaoId?:        string
  }

  if (!body.estacionamentoId || !body.placa?.trim()) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  const admin = createServiceClient()

  const { data: estacionamento } = await admin
    .from('estacionamentos')
    .select('id, event_id, cobra_modo, preco_fixo, estacionamento_portoes(id, tipo, ativo)')
    .eq('id', body.estacionamentoId)
    .single()

  if (!estacionamento) return NextResponse.json({ error: 'Estacionamento não encontrado' }, { status: 404 })

  if (!(await hasEventPermission(user.id, estacionamento.event_id, 'estacionamento_entrada'))) {
    return NextResponse.json({ error: 'Sem permissão para este evento' }, { status: 403 })
  }

  // Se o estacionamento tem portões cadastrados, a entrada precisa passar por
  // um portão válido (tipo entrada/ambos, ativo) — e se o atendente estiver
  // restrito a um portão específico, só pode usar esse.
  const portoes = (estacionamento.estacionamento_portoes ?? []) as { id: string; tipo: string; ativo: boolean }[]
  let portaoEntradaId: string | null = null

  if (portoes.length > 0) {
    if (!body.portaoId) {
      return NextResponse.json({ error: 'Selecione o portão de entrada' }, { status: 400 })
    }
    const portao = portoes.find(p => p.id === body.portaoId)
    if (!portao || !portao.ativo || !['entrada', 'ambos'].includes(portao.tipo)) {
      return NextResponse.json({ error: 'Portão inválido para entrada' }, { status: 400 })
    }
    const portaoRestrito = await getStaffPortao(user.id, estacionamento.event_id)
    if (portaoRestrito && portaoRestrito !== body.portaoId) {
      return NextResponse.json({ error: 'Você só pode registrar entrada pelo seu portão designado' }, { status: 403 })
    }
    portaoEntradaId = body.portaoId
  }

  // Preço fixo cobra na entrada — valida forma de pagamento e caixa antes de registrar.
  let valorCobrado:   number | null = null
  let formaPagamento: string  | null = null
  let caixaId:        string  | null = null

  if (estacionamento.cobra_modo === 'fixo') {
    const preco = Number(estacionamento.preco_fixo ?? 0)
    if (preco > 0) {
      if (!body.formaPagamento) {
        return NextResponse.json({ error: 'Selecione a forma de pagamento' }, { status: 400 })
      }
      if (body.formaPagamento === 'cortesia') {
        valorCobrado   = 0
        formaPagamento = 'cortesia'
      } else {
        if (!body.caixaId) {
          return NextResponse.json({ error: 'Selecione o caixa para registrar o pagamento' }, { status: 400 })
        }
        valorCobrado   = preco
        formaPagamento = body.formaPagamento
        caixaId        = body.caixaId
      }
    }
  }

  // Checagem de vagas + inserção acontecem atomicamente dentro da function —
  // trava a linha do estacionamento pra duas entradas simultâneas não furarem o limite.
  const { data: resultado, error: rpcError } = await admin.rpc('registrar_entrada_estacionamento', {
    p_estacionamento_id: body.estacionamentoId,
    p_placa:             body.placa.trim().toUpperCase(),
    p_nome_condutor:     body.nomeCondutor?.trim()     || null,
    p_telefone_condutor: body.telefoneCondutor?.trim() || null,
    p_registrado_por:    user.id,
    p_valor_cobrado:     valorCobrado,
    p_forma_pagamento:   formaPagamento,
    p_caixa_id:          caixaId,
    p_portao_entrada_id: portaoEntradaId,
  })

  if (rpcError) return NextResponse.json({ error: 'Erro ao registrar entrada' }, { status: 500 })

  if (resultado?.error === 'lotado') {
    return NextResponse.json({ error: 'Lotado — não há vagas disponíveis neste estacionamento.' }, { status: 409 })
  }
  if (resultado?.error === 'estacionamento_inativo') {
    return NextResponse.json({ error: 'Estacionamento inativo' }, { status: 400 })
  }
  if (resultado?.error === 'estacionamento_nao_encontrado') {
    return NextResponse.json({ error: 'Estacionamento não encontrado' }, { status: 404 })
  }
  if (!resultado?.sessao_id) {
    return NextResponse.json({ error: 'Erro ao registrar entrada' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sessaoId: resultado.sessao_id })
}
