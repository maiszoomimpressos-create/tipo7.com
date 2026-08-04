import { Injectable } from '@nestjs/common';
import { OrgAdminService } from '../org-admin/org-admin.service';
import { PrismaService } from '../prisma/prisma.service';

// Porte 1:1 de web/src/lib/eventPermissions.ts.
@Injectable()
export class EventPermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAdmin: OrgAdminService,
  ) {}

  // Dono/admin da organização do evento sempre tem acesso a tudo,
  // independente de cargo/permissão.
  async isEventOwner(userId: string, eventoId: string): Promise<boolean> {
    const evento = await this.prisma.event.findUnique({
      where: { id: eventoId },
      select: { organizationId: true },
    });
    if (!evento) return false;

    return this.orgAdmin.isOrgAdmin(evento.organizationId, userId);
  }

  // Dono do evento OU staff ativo com a permissão informada (event_permission
  // enum). Aceita uma permissão só ou uma lista — nesse caso basta ter
  // QUALQUER uma delas (ex: leitura de sessões de estacionamento serve tanto
  // pra quem só faz entrada quanto pra quem só faz saída).
  async hasEventPermission(
    userId: string,
    eventoId: string,
    permission: string | string[],
  ): Promise<boolean> {
    if (await this.isEventOwner(userId, eventoId)) return true;

    const staff = await this.prisma.eventStaff.findFirst({
      where: { eventId: eventoId, userId, status: 'active' },
      select: {
        eventPosition: {
          select: { eventPositionPermissions: { select: { permission: true } } },
        },
      },
    });
    if (!staff) return false;

    const required = Array.isArray(permission) ? permission : [permission];
    const granted = staff.eventPosition?.eventPositionPermissions ?? [];
    return granted.some((p) => required.includes(p.permission));
  }

  // Portão ao qual esse membro da equipe está restrito (null = sem
  // restrição, pode operar qualquer portão do estacionamento em que tiver
  // permissão). Dono do evento nunca tem restrição de portão.
  async getStaffPortao(userId: string, eventoId: string): Promise<string | null> {
    if (await this.isEventOwner(userId, eventoId)) return null;

    const staff = await this.prisma.eventStaff.findFirst({
      where: { eventId: eventoId, userId, status: 'active' },
      select: { portaoId: true },
    });
    return staff?.portaoId ?? null;
  }
}
