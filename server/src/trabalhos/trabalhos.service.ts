import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Porte 1:1 de web/src/app/api/trabalhos/{,responder}/route.ts.
@Injectable()
export class TrabalhosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(userId: string) {
    const staff = await this.prisma.eventStaff.findMany({
      where: { userId, status: { in: ['pending', 'active'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        event: { select: { id: true, title: true, dateStart: true, venueName: true, city: true, state: true, bannerUrl: true } },
        eventPosition: {
          select: { id: true, name: true, eventPositionPermissions: { select: { permission: true } } },
        },
        profile: { select: { fullName: true } },
      },
    });

    return {
      staff: staff.map((s) => ({
        id: s.id,
        status: s.status,
        created_at: s.createdAt,
        events: s.event,
        event_positions: s.eventPosition
          ? { id: s.eventPosition.id, name: s.eventPosition.name, event_position_permissions: s.eventPosition.eventPositionPermissions }
          : null,
        convidado_por: s.profile,
      })),
    };
  }

  async responder(userId: string, staffId: string | undefined, acao: string | undefined) {
    if (!staffId || !acao || !['aceitar', 'recusar'].includes(acao)) {
      throw new BadRequestException('Dados inválidos');
    }

    const registro = await this.prisma.eventStaff.findFirst({
      where: { id: staffId, userId, status: 'pending' },
      select: { id: true },
    });
    if (!registro) throw new NotFoundException('Convite não encontrado ou já respondido');

    const novoStatus = acao === 'aceitar' ? 'active' : 'rejected';
    await this.prisma.eventStaff.update({ where: { id: staffId }, data: { status: novoStatus } });

    return { ok: true, status: novoStatus };
  }
}
