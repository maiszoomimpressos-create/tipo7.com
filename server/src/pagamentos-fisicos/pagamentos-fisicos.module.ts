import { Module } from '@nestjs/common';
import { MockPaymentProvider } from './mock-payment.provider';
import { PagamentosFisicosController } from './pagamentos-fisicos.controller';
import { PagamentosFisicosService } from './pagamentos-fisicos.service';
import { PAYMENT_PROVIDER } from './payment-provider.interface';

// Módulo genérico de cobrança de cartão físico — qualquer módulo de negócio
// (estacionamento, bilheteria, futuro tenda/praça de alimentação) importa
// este módulo e injeta PagamentosFisicosService, nunca fala com adquirente/
// TEF direto. Ver payment-provider.interface.ts pro racional completo.
//
// PONTO DE TROCA pra quando a decisão comercial (TEF vs adquirente) fechar:
// trocar `useClass: MockPaymentProvider` pela implementação real. Nada nos
// módulos que já usam PagamentosFisicosService precisa mudar.
@Module({
  controllers: [PagamentosFisicosController],
  providers: [
    PagamentosFisicosService,
    { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider },
  ],
  exports: [PagamentosFisicosService],
})
export class PagamentosFisicosModule {}
