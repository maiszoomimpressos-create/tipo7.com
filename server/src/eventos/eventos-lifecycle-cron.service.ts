import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventosAdminService } from './eventos-admin.service';

// Automação de ciclo de vida do evento (20/08/2026, design combinado — ver
// project_token_pin_acesso_caixa na memória). Motivada por um achado real:
// evento de teste com dateEnd passado há 4 dias, ainda 100% publicado e
// vendendo/operando normalmente — nada no sistema fazia essa transição
// sozinho.
//
// Buffers fixos por enquanto (pedido do usuário, 20/08/2026: "menos escopo
// agora", configurável por evento fica pra depois):
// - pausa venda online: 1h antes do dateStart
// - encerramento automático: 2 dias depois do dateEnd
//
// Regra de ouro do automático: NUNCA força. Se tiver pendência (caixa
// aberto, sessão de estacionamento aberta) no prazo, só pula e loga — quem
// resolve é o organizador, manual, com o caminho de exceção (senha/PIN).
const BUFFER_PAUSA_VENDA_MS = 60 * 60 * 1000; // 1h
const BUFFER_ENCERRAMENTO_DIAS = 2;

@Injectable()
export class EventosLifecycleCronService {
  private readonly logger = new Logger(EventosLifecycleCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventosAdmin: EventosAdminService,
  ) {}

  // A cada 10 minutos — não precisa ser mais fino que isso, o buffer é de 1h.
  @Cron('*/10 * * * *')
  async pausarVendasAutomaticamente() {
    const limite = new Date(Date.now() + BUFFER_PAUSA_VENDA_MS);
    const { count } = await this.prisma.event.updateMany({
      where: {
        status: 'publicado',
        vendasOnlinePausadas: false,
        dateStart: { not: null, lte: limite },
      },
      data: { vendasOnlinePausadas: true },
    });
    if (count > 0) this.logger.log(`Vendas pausadas automaticamente em ${count} evento(s) (dateStart <= agora + 1h).`);
  }

  // Uma vez por dia — encerramento não precisa de granularidade fina.
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async encerrarEventosAutomaticamente() {
    const limite = new Date(Date.now() - BUFFER_ENCERRAMENTO_DIAS * 24 * 60 * 60 * 1000);
    const candidatos = await this.prisma.event.findMany({
      where: { status: 'publicado', dateEnd: { not: null, lte: limite } },
      select: { id: true, title: true },
    });

    for (const evento of candidatos) {
      const pendencias = await this.eventosAdmin.calcularPendenciasEncerramento(evento.id);
      if (!pendencias.pode_encerrar) {
        this.logger.warn(
          `Evento "${evento.title ?? evento.id}" venceu o prazo de encerramento automático mas tem pendência ` +
            `(${pendencias.caixas_pendentes.length} caixa(s), ${pendencias.sessoes_abertas.length} sessão(ões)) — não força, aguardando organizador.`,
        );
        continue;
      }
      await this.eventosAdmin.fecharEventoDeVerdade(evento.id, { forcado: false, por: null, snapshot: null });
      this.logger.log(`Evento "${evento.title ?? evento.id}" encerrado automaticamente (dateEnd + ${BUFFER_ENCERRAMENTO_DIAS} dias).`);
    }
  }
}
