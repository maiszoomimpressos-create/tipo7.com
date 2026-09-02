import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { PagamentosFisicosService } from './pagamentos-fisicos.service';

// Único endpoint HTTP do módulo. Existe pra ser chamado pela ponte
// JS↔Android do app da GPOS780 (ver android/), que hoje aciona o
// MockPaymentProvider e depois de fechada a decisão comercial vai acionar
// o SDK real (SiTef/PayGo) do lado nativo antes de bater aqui. Mesma auth
// Bearer que o resto do backend usa — a sessão do login por token+PIN
// (rota pública /caixa) já gera um JWT válido pra esse guard.
//
// Não confundir com a chamada automática que estacionamento.service.ts já
// faz hoje ao fechar um ticket com formaPagamento='cartao' — aquele fluxo
// continua existindo em paralelo por enquanto; unificar os dois é decisão
// separada, pra quando o SDK real entrar (ver docs/maquininha-gpos780-levantamento-requisitos.md).
@UseGuards(SupabaseJwtGuard)
@Controller('pagamentos-fisicos')
export class PagamentosFisicosController {
  constructor(private readonly pagamentosFisicos: PagamentosFisicosService) {}

  @Post('cobrar')
  cobrar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { valor: number; caixaId: string; origem: string; origemId?: string },
  ) {
    return this.pagamentosFisicos.cobrar({ ...body, criadoPor: user.id });
  }
}
