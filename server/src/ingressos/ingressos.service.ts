import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrgAdminService } from '../org-admin/org-admin.service';
import { PrismaService } from '../prisma/prisma.service';

// Porte 1:1 de web/src/app/api/ingressos/[id]/route.ts.
// Regras: quantidade >= vendidos; soma de todos <= capacidade do evento.
@Injectable()
export class IngressosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAdmin: OrgAdminService,
  ) {}

  async atualizar(userId: string, ticketId: string, body: { name?: string; price?: number; quantity?: number }) {
    const ticket = await this.prisma.eventTicket.findUnique({ where: { id: ticketId }, select: { id: true, eventId: true } });
    if (!ticket) throw new NotFoundException('Ingresso não encontrado');

    const evento = await this.prisma.event.findUnique({
      where: { id: ticket.eventId },
      select: { id: true, capacity: true, organizationId: true },
    });
    if (!evento) throw new NotFoundException('Evento não encontrado');

    if (!(await this.orgAdmin.isOrgAdmin(evento.organizationId, userId))) {
      throw new ForbiddenException('Sem permissão');
    }

    if (body.quantity !== undefined) {
      const soldRows = await this.prisma.orderItem.findMany({
        where: { ticketId, order: { status: 'approved' } },
        select: { quantity: true },
      });
      const totalSold = soldRows.reduce((sum, r) => sum + (r.quantity ?? 0), 0);

      if (body.quantity < totalSold) {
        throw new BadRequestException(
          `Quantidade mínima é ${totalSold} (já vendidos). Você não pode remover ingressos já vendidos.`,
        );
      }

      if (evento.capacity) {
        const outrosIngressos = await this.prisma.eventTicket.findMany({
          where: { eventId: ticket.eventId, id: { not: ticketId } },
          select: { quantity: true },
        });
        const somaOutros = outrosIngressos.reduce((sum, t) => sum + (t.quantity ?? 0), 0);

        if (somaOutros + body.quantity > evento.capacity) {
          const disponivel = evento.capacity - somaOutros;
          throw new BadRequestException(
            `Capacidade insuficiente. Máximo disponível para este tipo: ${disponivel} (capacidade total: ${evento.capacity}).`,
          );
        }
      }
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.price !== undefined) updates.price = body.price;
    if (body.quantity !== undefined) updates.quantity = body.quantity;

    if (Object.keys(updates).length === 0) throw new BadRequestException('Nenhum campo para atualizar');

    await this.prisma.eventTicket.update({ where: { id: ticketId }, data: updates });
    return { ok: true };
  }
}
