import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { hasEventPermission, getStaffPortao } from '@/lib/eventPermissions'
import { calcularValorEstacionamento } from '@/lib/estacionamentoPricing'
import { rateLimit, getIp, tooManyRequests } from '@/lib/rateLimit'

// POST /api/estacionamento/saida
// body: { sessaoId, caixaId?, formaPagamento?, portaoId? }
// caixaId só é obrigatório quando o estacionamento realmente cobra (cobra_modo != 'gratis')
// e a forma de pagamento não é 'cortesia'. portaoId é exigido só se o
// estacionamento tiver portões cadastrados — o carro pode sair por qualquer
// portão tipo saída/ambos, não precisa ser o mesmo por onde entrou.
export async function POST(req: NextRequest) {
  if (!(await rateLimit(getIp(req), 'estacionamento-saida', 60, 60_000))) return tooManyRequests()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as {
    sessaoId:        string
    caixaId?:        string
    formaPagamento?: 'dinheiro' | 'pix' | 'cartao' | 'cortesia'
    portaoId?:       string
  }

  if (!body.sessaoId) return NextResponse.json({ error: 'sessaoId obrigatório' }, { status: 400 })

  const admin = createServiceClient()

  const { data: sessao } = await admin
    .from('estacionamento_sessoes')
    .select('id, estacionamento_id, entrada_em, status, valor_cobrado, estacionamentos(id, event_id, cobra_modo, preco_fixo, preco_primeira_hora, preco_hora_adicional, teto_diario, tolerancia_minutos, estacionamento_portoes(id, tipo, ativo))')
    .eq('id', body.sessaoId)
    .single()

  if (!sessao) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
  if (sessao.status !== 'aberto') return NextResponse.json({ error: 'Sessão já encerrada' }, { status: 400 })

  const config = sessao.estacionamentos as unknown as {
    id: string; event_id: string
    cobra_modo: 'gratis' | 'fixo' | 'por_tempo'
    preco_fixo: number | null
    preco_primeira_hora: number | null
    preco_hora_adicional: number | null
    teto_diario: number | null
    tolerancia_minutos: number
    estacionamento_portoes: { id: string; tipo: string; ativo: boolean }[]
  } | null

  if (!config) return NextResponse.json({ error: 'Estacionamento não encontrado' }, { status: 404 })

  if (!(await hasEventPermission(user.id, config.event_id, 'estacionamento_saida'))) {
    return NextResponse.json({ error: 'Sem permissão para este evento' }, { status: 403 })
  }

  // Se o estacionamento tem portões cadastrados, a saída precisa passar por
  // um portão válido (tipo saída/ambos, ativo) — não precisa ser o mesmo
  // portão por onde o carro entrou. Atendente restrito só usa o seu.
  const portoes = config.estacionamento_portoes ?? []
  let portaoSaidaId: string | null = null

  if (portoes.length > 0) {
    if (!body.portaoId) {
      return NextResponse.json({ error: 'Selecione o portão de saída' }, { status: 400 })
    }
    const portao = portoes.find(p => p.id === body.portaoId)
    if (!portao || !portao.ativo || !['saida', 'ambos'].includes(portao.tipo)) {
      return NextResponse.json({ error: 'Portão inválido para saída' }, { status: 400 })
    }
    const portaoRestrito = await getStaffPortao(user.id, config.event_id)
    if (portaoRestrito && portaoRestrito !== body.portaoId) {
      return NextResponse.json({ error: 'Você só pode registrar saída pelo seu portão designado' }, { status: 403 })
    }
    portaoSaidaId = body.portaoId
  }

  const saidaEm = new Date()
  let valorCobrado: number | null = null
  let status: 'pago' | 'encerrado' = 'encerrado'
  let caixaId: string | null = null
  let formaPagamento: string | null = null
  let jaCobradoNaEntrada = false

  if (config.cobra_modo === 'fixo') {
    // Preço fixo já foi cobrado na entrada — saída só fecha a sessão, sem
    // mexer em valor_cobrado/forma_pagamento/caixa_id (que já estão gravados).
    jaCobradoNaEntrada = true
    valorCobrado = Number(sessao.valor_cobrado ?? 0)
    status = valorCobrado > 0 ? 'pago' : 'encerrado'
  } else if (config.cobra_modo === 'gratis') {
    valorCobrado = null
    status       = 'encerrado'
  } else if (body.formaPagamento === 'cortesia') {
    valorCobrado   = 0
    status         = 'encerrado'
    formaPagamento = 'cortesia'
    caixaId        = body.caixaId ?? null
  } else {
    const valor = calcularValorEstacionamento(config, sessao.entrada_em, saidaEm)
    if (valor > 0 && !body.caixaId) {
      return NextResponse.json({ error: 'Selecione o caixa para registrar o pagamento' }, { status: 400 })
    }
    if (body.caixaId) {
      const { data: caixa } = await admin
        .from('caixas')
        .select('id, evento_id, status')
        .eq('id', body.caixaId)
        .single()
      if (!caixa || caixa.evento_id !== config.event_id || caixa.status !== 'aberto') {
        return NextResponse.json({ error: 'Caixa inválido ou fechado' }, { status: 400 })
      }
    }
    valorCobrado   = valor
    status         = 'pago'
    caixaId        = body.caixaId ?? null
    formaPagamento = body.formaPagamento ?? 'dinheiro'
  }

  const { error } = await admin
    .from('estacionamento_sessoes')
    .update(
      jaCobradoNaEntrada
        ? { saida_em: saidaEm.toISOString(), status, portao_saida_id: portaoSaidaId }
        : { saida_em: saidaEm.toISOString(), valor_cobrado: valorCobrado, forma_pagamento: formaPagamento, caixa_id: caixaId, status, portao_saida_id: portaoSaidaId }
    )
    .eq('id', body.sessaoId)

  if (error) return NextResponse.json({ error: 'Erro ao registrar saída' }, { status: 500 })

  return NextResponse.json({ ok: true, valorCobrado, status })
}
