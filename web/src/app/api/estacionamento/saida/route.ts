import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { hasEventPermission } from '@/lib/eventPermissions'
import { calcularValorEstacionamento } from '@/lib/estacionamentoPricing'
import { rateLimit, getIp, tooManyRequests } from '@/lib/rateLimit'

// POST /api/estacionamento/saida
// body: { sessaoId, caixaId?, formaPagamento? }
// caixaId só é obrigatório quando o estacionamento realmente cobra (cobra_modo != 'gratis')
// e a forma de pagamento não é 'cortesia'.
export async function POST(req: NextRequest) {
  if (!(await rateLimit(getIp(req), 'estacionamento-saida', 60, 60_000))) return tooManyRequests()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as {
    sessaoId:        string
    caixaId?:        string
    formaPagamento?: 'dinheiro' | 'pix' | 'cartao' | 'cortesia'
  }

  if (!body.sessaoId) return NextResponse.json({ error: 'sessaoId obrigatório' }, { status: 400 })

  const admin = createServiceClient()

  const { data: sessao } = await admin
    .from('estacionamento_sessoes')
    .select('id, estacionamento_id, entrada_em, status, estacionamentos(id, event_id, cobra_modo, preco_fixo, preco_primeira_hora, preco_hora_adicional, teto_diario, tolerancia_minutos)')
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
  } | null

  if (!config) return NextResponse.json({ error: 'Estacionamento não encontrado' }, { status: 404 })

  if (!(await hasEventPermission(user.id, config.event_id, 'gerenciar_estacionamento'))) {
    return NextResponse.json({ error: 'Sem permissão para este evento' }, { status: 403 })
  }

  const saidaEm = new Date()
  let valorCobrado: number | null = null
  let status: 'pago' | 'encerrado' = 'encerrado'
  let caixaId: string | null = null
  let formaPagamento: string | null = null

  if (config.cobra_modo === 'gratis') {
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
    .update({
      saida_em:        saidaEm.toISOString(),
      valor_cobrado:   valorCobrado,
      forma_pagamento: formaPagamento,
      caixa_id:        caixaId,
      status,
    })
    .eq('id', body.sessaoId)

  if (error) return NextResponse.json({ error: 'Erro ao registrar saída' }, { status: 500 })

  return NextResponse.json({ ok: true, valorCobrado, status })
}
