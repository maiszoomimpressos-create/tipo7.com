import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ChargeRequest, PaymentProvider } from './payment-provider.interface';
import { PAYMENT_PROVIDER } from './payment-provider.interface';

@Injectable()
export class PagamentosFisicosService {
  private readonly logger = new Logger(PagamentosFisicosService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  // Ponto único de entrada pra qualquer módulo cobrar cartão físico. Sempre
  // grava um registro em pagamentos_fisicos (mesmo que a cobrança falhe) —
  // isso vira o histórico/conciliação de cartão, equivalente ao que
  // dinheiro/PIX já têm hoje. Quem chama decide o que fazer com o resultado
  // (fechar ticket se aprovado, devolver erro pro operador se negado).
  async cobrar(req: ChargeRequest & { criadoPor?: string }) {
    const registro = await this.prisma.pagamentoFisico.create({
      data: {
        caixaId: req.caixaId,
        origem: req.origem,
        origemId: req.origemId,
        valor: req.valor,
        status: 'pendente',
        provider: this.provider.nome,
        criadoPor: req.criadoPor,
      },
    });

    try {
      const resultado = await this.provider.cobrar(req);
      return await this.prisma.pagamentoFisico.update({
        where: { id: registro.id },
        data: {
          status: resultado.aprovado ? 'aprovado' : 'negado',
          nsu: resultado.nsu,
          bandeira: resultado.bandeira,
          autorizacao: resultado.autorizacao,
          mensagemErro: resultado.mensagemErro,
          finalizadoEm: new Date(),
        },
      });
    } catch (e) {
      this.logger.error(`Falha ao cobrar cartão físico (registro ${registro.id})`, e instanceof Error ? e.stack : undefined);
      return await this.prisma.pagamentoFisico.update({
        where: { id: registro.id },
        data: {
          status: 'erro',
          mensagemErro: e instanceof Error ? e.message : 'Erro desconhecido ao cobrar cartão',
          finalizadoEm: new Date(),
        },
      });
    }
  }
}
