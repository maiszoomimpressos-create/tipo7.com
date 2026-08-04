import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { OrgAdminService } from '../org-admin/org-admin.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAdmin: OrgAdminService,
    private readonly audit: AuditService,
  ) {}

  private async checkPermission(userId: string, eventoId: string): Promise<boolean> {
    const evento = await this.prisma.event.findUnique({ where: { id: eventoId }, select: { organizationId: true } });
    if (!evento) return false;

    if (await this.orgAdmin.isOrgAdmin(evento.organizationId, userId)) return true;

    const staff = await this.prisma.eventStaff.findFirst({
      where: { eventId: eventoId, userId, status: 'active' },
      select: { eventPosition: { select: { eventPositionPermissions: { select: { permission: true } } } } },
    });
    if (!staff) return false;

    return (staff.eventPosition?.eventPositionPermissions ?? []).some((p) => p.permission === 'validar_ingresso');
  }

  async validate(userId: string, ip: string, body: { qr_token?: string; eventoId?: string }) {
    const { qr_token, eventoId } = body;
    if (!qr_token || !eventoId) throw new BadRequestException('Dados incompletos');

    if (!(await this.checkPermission(userId, eventoId))) throw new ForbiddenException('Sem permissão para este evento');

    const ticket = await this.prisma.ticket.findUnique({
      where: { qrToken: qr_token },
      select: {
        id: true, status: true, slotNumber: true, orderId: true,
        orderItem: {
          select: {
            ticket: { select: { name: true } },
            ticketHolders: { select: { slotNumber: true, fullName: true } },
          },
        },
        order: { select: { eventId: true } },
      },
    });

    if (!ticket) {
      await this.prisma.ticketValidation.create({
        data: { eventId: eventoId, scannedBy: userId, result: 'invalid', rawToken: qr_token },
      });
      return { result: 'invalid', message: 'Ingresso não encontrado.' };
    }

    if (ticket.order.eventId !== eventoId) {
      await this.prisma.ticketValidation.create({
        data: { ticketId: ticket.id, eventId: eventoId, scannedBy: userId, result: 'wrong_event', rawToken: qr_token },
      });
      return { result: 'wrong_event', message: 'Ingresso pertence a outro evento.' };
    }

    if (ticket.status === 'cancelled') {
      await this.prisma.ticketValidation.create({
        data: { ticketId: ticket.id, eventId: eventoId, scannedBy: userId, result: 'cancelled', rawToken: qr_token },
      });
      return { result: 'cancelled', message: 'Ingresso cancelado.' };
    }

    if (ticket.status === 'used') {
      const lastValidation = await this.prisma.ticketValidation.findFirst({
        where: { ticketId: ticket.id, result: 'valid' },
        orderBy: { scannedAt: 'desc' },
        select: { scannedAt: true, profile: { select: { fullName: true } } },
      });

      await this.prisma.ticketValidation.create({
        data: { ticketId: ticket.id, eventId: eventoId, scannedBy: userId, result: 'already_used', rawToken: qr_token },
      });

      return {
        result: 'already_used',
        message: 'Este ingresso já foi utilizado.',
        validatedAt: lastValidation?.scannedAt ?? null,
        validatedBy: lastValidation?.profile?.fullName ?? 'Desconhecido',
      };
    }

    // Ingresso válido — autoriza entrada. updateMany com where status='valid'
    // é a mesma trava otimista contra corrida do original (evita duplo-scan
    // simultâneo marcar 'used' duas vezes).
    const ticketName = ticket.orderItem.ticket?.name ?? 'Ingresso';
    const holderName = ticket.orderItem.ticketHolders.find((h) => h.slotNumber === ticket.slotNumber)?.fullName ?? null;

    const marcado = await this.prisma.ticket.updateMany({
      where: { id: ticket.id, status: 'valid' },
      data: { status: 'used', validatedAt: new Date(), validatedBy: userId },
    });

    if (marcado.count === 0) {
      await this.prisma.ticketValidation.create({
        data: { ticketId: ticket.id, eventId: eventoId, scannedBy: userId, result: 'already_used', rawToken: qr_token },
      });
      return { result: 'already_used', message: 'Este ingresso já foi utilizado.' };
    }

    await this.prisma.ticketValidation.create({
      data: { ticketId: ticket.id, eventId: eventoId, scannedBy: userId, result: 'valid', rawToken: qr_token },
    });

    await this.audit.logAudit({
      userId,
      action: 'validar_ingresso',
      resourceType: 'ticket',
      resourceId: ticket.id,
      details: { eventoId, result: 'valid', holderName, ticketName },
      ip,
    });

    return { result: 'valid', message: 'Entrada autorizada.', holderName, ticketName };
  }
}
