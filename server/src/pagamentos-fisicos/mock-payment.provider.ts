import { Injectable, Logger } from '@nestjs/common';
import { ChargeRequest, ChargeResult, PaymentProvider } from './payment-provider.interface';

// Implementação provisória enquanto a decisão comercial (TEF terceirizado vs
// adquirente direta — ver docs/maquininha-gpos780-levantamento-requisitos.md)
// não fecha. Aprova toda cobrança na hora, sem falar com hardware nenhum, só
// pra deixar a esteira completa (fechar ticket, imprimir, cair na
// conciliação de caixa) testável hoje. NÃO USAR EM PRODUÇÃO PRA COBRANÇA REAL
// — isso não move dinheiro nenhum, é só "aprova sempre".
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly nome = 'mock';
  private readonly logger = new Logger(MockPaymentProvider.name);

  async cobrar(req: ChargeRequest): Promise<ChargeResult> {
    this.logger.warn(
      `Cobrança MOCK de R$ ${req.valor.toFixed(2)} (origem=${req.origem}/${req.origemId ?? '-'}, caixa=${req.caixaId}) — aprovada automaticamente, nenhum cartão foi cobrado de verdade.`,
    );
    return {
      aprovado: true,
      nsu: `MOCK${Date.now()}`,
      bandeira: 'mock',
      autorizacao: `AUT${Math.floor(Math.random() * 1_000_000)}`,
    };
  }
}
