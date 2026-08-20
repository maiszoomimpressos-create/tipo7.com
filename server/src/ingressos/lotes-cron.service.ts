import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LotesService } from './lotes.service';

// Pega as duas transições que NÃO acontecem por alguém mexendo num lote na
// tela: (1) uma venda que cruzou a fronteira de quantidade do lote atual —
// resincronizar() só roda quando o promotor cria/edita/apaga um lote, uma
// venda sozinha não dispara isso; (2) data de corte que chegou sem ninguém
// tocar em nada. A cada 10 min é suficiente — mesmo raciocínio de
// EventosLifecycleCronService: prefere um atraso curto a arriscar tocar
// direto no fluxo de checkout pra deixar isso instantâneo.
@Injectable()
export class IngressosLotesCronService {
  private readonly logger = new Logger(IngressosLotesCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lotes: LotesService,
  ) {}

  @Cron('*/10 * * * *')
  async resincronizarTodosOsLotes() {
    const ticketIds = await this.prisma.ticketLote.findMany({
      distinct: ['ticketId'],
      select: { ticketId: true },
    });
    if (ticketIds.length === 0) return;

    let atualizados = 0;
    for (const { ticketId } of ticketIds) {
      try {
        await this.lotes.resincronizar(ticketId);
        atualizados++;
      } catch (err) {
        this.logger.error(`[lotes-cron] falha ao resincronizar ticket ${ticketId}`, err as Error);
      }
    }
    this.logger.log(`Lotes resincronizados: ${atualizados}/${ticketIds.length} ingresso(s) com lote configurado.`);
  }
}
