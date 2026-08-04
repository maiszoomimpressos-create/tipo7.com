import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrgAdminService } from '../org-admin/org-admin.service';
import { EventPermissionsService } from '../event-permissions/event-permissions.service';
import { PrismaService } from '../prisma/prisma.service';

const PERMISSOES_ESTACIONAMENTO = ['estacionamento_entrada', 'estacionamento_saida'];

@Injectable()
export class EventosAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAdmin: OrgAdminService,
    private readonly eventPermissions: EventPermissionsService,
  ) {}

  private async assertOwner(userId: string, eventoId: string): Promise<void> {
    const evento = await this.prisma.event.findUnique({ where: { id: eventoId }, select: { organizationId: true } });
    if (!evento || !(await this.orgAdmin.isOrgAdmin(evento.organizationId, userId))) {
      throw new ForbiddenException('Sem permissão');
    }
  }

  // Estacionamento é produto à parte: sem pátio cadastrado, remove as
  // permissões de estacionamento (impede burlar por request forjado).
  private async filtrarPorProduto(eventoId: string, permissoes: string[]): Promise<string[]> {
    if (!permissoes?.some((p) => PERMISSOES_ESTACIONAMENTO.includes(p))) return permissoes ?? [];
    const count = await this.prisma.estacionamento.count({ where: { eventId: eventoId } });
    if (count > 0) return permissoes;
    return permissoes.filter((p) => !PERMISSOES_ESTACIONAMENTO.includes(p));
  }

  // ==== equipe ====

  async listEquipe(userId: string, eventoId: string) {
    await this.assertOwner(userId, eventoId);

    const staff = await this.prisma.eventStaff.findMany({
      where: { eventId: eventoId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, status: true, createdAt: true, userId: true, portaoId: true,
        user: { select: { id: true, fullName: true, userCode: true } },
        eventPosition: { select: { id: true, name: true, eventPositionPermissions: { select: { permission: true } } } },
        portao: { select: { id: true, nome: true } },
      },
    });

    const userIds = staff.map((s) => s.userId);
    const emailMap = new Map<string, string>();
    if (userIds.length > 0) {
      const rows = await this.prisma.$queryRaw<{ id: string; email: string }[]>`
        SELECT * FROM get_user_emails(${userIds}::uuid[])
      `;
      for (const r of rows) emailMap.set(r.id, r.email ?? '');
    }

    return {
      staff: staff.map((s) => ({
        id: s.id,
        status: s.status,
        created_at: s.createdAt,
        user_id: s.userId,
        portao_id: s.portaoId,
        profiles: s.user,
        event_positions: s.eventPosition,
        estacionamento_portoes: s.portao,
        email: emailMap.get(s.userId) ?? null,
        userCode: s.user?.userCode ?? null,
      })),
    };
  }

  async adicionarMembro(
    userId: string,
    eventoId: string,
    body: { emailOuCodigo?: string; funcaoId?: string; portaoId?: string },
  ) {
    await this.assertOwner(userId, eventoId);

    if (!body.emailOuCodigo || !body.funcaoId) {
      throw new BadRequestException('Email/código e função são obrigatórios');
    }
    const busca = body.emailOuCodigo.trim();

    let targetUserId: string | null = null;
    if (busca.toUpperCase().startsWith('T7-')) {
      const perfil = await this.prisma.profile.findFirst({
        where: { userCode: busca.toUpperCase() },
        select: { id: true },
      });
      targetUserId = perfil?.id ?? null;
    } else {
      const rows = await this.prisma.$queryRaw<{ find_user_id_by_email: string | null }[]>`
        SELECT find_user_id_by_email(${busca})
      `;
      targetUserId = rows[0]?.find_user_id_by_email ?? null;
    }

    if (!targetUserId) {
      throw new NotFoundException('Usuário não encontrado. Verifique o email ou código T7-USR.');
    }
    if (targetUserId === userId) {
      throw new BadRequestException('Você já é o organizador deste evento.');
    }

    const funcao = await this.prisma.eventPosition.findFirst({
      where: { id: body.funcaoId, eventId: eventoId },
      select: { id: true },
    });
    if (!funcao) throw new NotFoundException('Função não encontrada neste evento');

    let portaoId: string | null = null;
    if (body.portaoId) {
      const portao = await this.prisma.estacionamentoPortao.findFirst({
        where: { id: body.portaoId, estacionamento: { eventId: eventoId } },
        select: { id: true },
      });
      if (!portao) throw new NotFoundException('Portão não encontrado neste evento');
      portaoId = body.portaoId;
    }

    await this.prisma.eventStaff.upsert({
      where: { eventId_userId: { eventId: eventoId, userId: targetUserId } },
      create: {
        eventId: eventoId,
        userId: targetUserId,
        eventPositionId: funcao.id,
        portaoId,
        status: 'pending',
        invitedBy: userId,
      },
      update: {
        eventPositionId: funcao.id,
        portaoId,
        status: 'pending',
        invitedBy: userId,
      },
    });

    return { ok: true };
  }

  async atualizarMembro(
    userId: string,
    eventoId: string,
    body: { staffId?: string; funcaoId?: string; portaoId?: string | null },
  ) {
    await this.assertOwner(userId, eventoId);

    if (!body.staffId || !body.funcaoId) {
      throw new BadRequestException('staffId e funcaoId são obrigatórios');
    }

    const funcao = await this.prisma.eventPosition.findFirst({
      where: { id: body.funcaoId, eventId: eventoId },
      select: { id: true },
    });
    if (!funcao) throw new NotFoundException('Função não encontrada neste evento');

    const data: { eventPositionId: string; portaoId?: string | null } = { eventPositionId: body.funcaoId };

    if (body.portaoId !== undefined) {
      if (body.portaoId === null) {
        data.portaoId = null;
      } else {
        const portao = await this.prisma.estacionamentoPortao.findFirst({
          where: { id: body.portaoId, estacionamento: { eventId: eventoId } },
          select: { id: true },
        });
        if (!portao) throw new NotFoundException('Portão não encontrado neste evento');
        data.portaoId = body.portaoId;
      }
    }

    await this.prisma.eventStaff.updateMany({ where: { id: body.staffId, eventId: eventoId }, data });
    return { ok: true };
  }

  async removerMembro(userId: string, eventoId: string, staffId: string) {
    await this.assertOwner(userId, eventoId);
    await this.prisma.eventStaff.deleteMany({ where: { id: staffId, eventId: eventoId } });
    return { ok: true };
  }

  // ==== funções ====

  async listFuncoes(userId: string, eventoId: string) {
    await this.assertOwner(userId, eventoId);
    const funcoes = await this.prisma.eventPosition.findMany({
      where: { eventId: eventoId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, eventPositionPermissions: { select: { permission: true } } },
    });
    return {
      funcoes: funcoes.map((f) => ({
        id: f.id,
        name: f.name,
        event_position_permissions: f.eventPositionPermissions,
      })),
    };
  }

  async criarFuncao(userId: string, eventoId: string, body: { nome?: string; permissoes?: string[] }) {
    await this.assertOwner(userId, eventoId);

    if (!body.nome?.trim()) throw new BadRequestException('Nome da função é obrigatório');

    const permsValidas = await this.filtrarPorProduto(eventoId, body.permissoes ?? []);

    const funcao = await this.prisma.eventPosition.create({
      data: { eventId: eventoId, name: body.nome.trim() },
      select: { id: true },
    });

    if (permsValidas.length > 0) {
      await this.prisma.eventPositionPermission.createMany({
        data: permsValidas.map((p) => ({ eventPositionId: funcao.id, permission: p as never })),
      });
    }

    return { ok: true, id: funcao.id };
  }

  async atualizarFuncao(
    userId: string,
    eventoId: string,
    funcaoId: string,
    body: { nome?: string; permissoes?: string[] },
  ) {
    await this.assertOwner(userId, eventoId);

    if (body.nome?.trim()) {
      await this.prisma.eventPosition.updateMany({
        where: { id: funcaoId, eventId: eventoId },
        data: { name: body.nome.trim() },
      });
    }

    if (body.permissoes !== undefined) {
      const permsValidas = await this.filtrarPorProduto(eventoId, body.permissoes);
      await this.prisma.eventPositionPermission.deleteMany({ where: { eventPositionId: funcaoId } });
      if (permsValidas.length > 0) {
        await this.prisma.eventPositionPermission.createMany({
          data: permsValidas.map((p) => ({ eventPositionId: funcaoId, permission: p as never })),
        });
      }
    }

    return { ok: true };
  }

  async removerFuncao(userId: string, eventoId: string, funcaoId: string) {
    await this.assertOwner(userId, eventoId);

    const count = await this.prisma.eventStaff.count({
      where: { eventPositionId: funcaoId, status: { in: ['pending', 'active'] } },
    });
    if (count > 0) {
      throw new ConflictException('Não é possível excluir uma função com membros ativos ou pendentes.');
    }

    await this.prisma.eventPosition.deleteMany({ where: { id: funcaoId, eventId: eventoId } });
    return { ok: true };
  }

  // ==== módulos ====

  async atualizarModulos(
    userId: string,
    eventoId: string,
    body: { moduloIngressos?: boolean; moduloEstacionamento?: boolean },
  ) {
    if (!(await this.eventPermissions.isEventOwner(userId, eventoId))) throw new ForbiddenException('Sem permissão');

    const atual = await this.prisma.event.findUnique({
      where: { id: eventoId },
      select: { moduloIngressos: true, moduloEstacionamento: true },
    });
    if (!atual) throw new NotFoundException('Evento não encontrado');

    const novoIngressos = body.moduloIngressos ?? atual.moduloIngressos;
    const novoEstacionamento = body.moduloEstacionamento ?? atual.moduloEstacionamento;

    if (!novoIngressos && !novoEstacionamento) {
      throw new BadRequestException('O evento precisa ter ao menos um módulo ativo');
    }

    await this.prisma.event.update({
      where: { id: eventoId },
      data: { moduloIngressos: novoIngressos, moduloEstacionamento: novoEstacionamento },
    });

    return { ok: true, moduloIngressos: novoIngressos, moduloEstacionamento: novoEstacionamento };
  }

  // ==== publicar ====

  async publicar(userId: string, eventoId: string) {
    const evento = await this.prisma.event.findUnique({
      where: { id: eventoId },
      select: { id: true, title: true, dateStart: true, city: true, venueName: true, organizationId: true, paymentGateway: true },
    });
    if (!evento) throw new NotFoundException('Evento não encontrado');

    const org = await this.prisma.organization.findUnique({
      where: { id: evento.organizationId },
      select: { ownerId: true },
    });
    if (!(await this.orgAdmin.isOrgAdmin(evento.organizationId, userId))) throw new ForbiddenException('Sem permissão');

    const ingressos = await this.prisma.eventTicket.findMany({
      where: { eventId: eventoId },
      select: { name: true, quantity: true },
    });

    const gateway = evento.paymentGateway === 'pagbank' ? 'pagbank' : 'mercadopago';

    const contaGateway =
      gateway === 'pagbank'
        ? await this.prisma.promotorPagbankAccount.findUnique({ where: { userId: org?.ownerId ?? '' }, select: { id: true } })
        : await this.prisma.promotorMpAccount.findUnique({ where: { userId: org?.ownerId ?? '' }, select: { id: true } });

    const faltando: string[] = [];
    if (!evento.title) faltando.push('título');
    if (!evento.dateStart) faltando.push('data');
    if (!evento.city && !evento.venueName) faltando.push('local');
    if (!ingressos.length || !ingressos.every((t) => t.name && Number(t.quantity ?? 0) > 0)) faltando.push('ingressos');
    if (!contaGateway) faltando.push(`conta ${gateway === 'pagbank' ? 'PagBank' : 'Mercado Pago'} conectada`);

    if (faltando.length > 0) {
      throw new BadRequestException(`Não é possível publicar — faltando: ${faltando.join(', ')}.`);
    }

    await this.prisma.event.update({ where: { id: eventoId }, data: { status: 'publicado' } });
    return { ok: true };
  }

  // ==== criar-filho ====
  // "evento dentro do evento" — mesma organização do pai, ingresso/caixa/
  // status próprios. Só permite um nível de aninhamento.

  async listFilhos(userId: string, eventoId: string) {
    await this.assertOwner(userId, eventoId);

    const filhos = await this.prisma.event.findMany({
      where: { parentEventId: eventoId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, status: true, dateStart: true, createdAt: true },
    });
    return {
      filhos: filhos.map((f) => ({
        id: f.id,
        title: f.title,
        status: f.status,
        date_start: f.dateStart,
        created_at: f.createdAt,
      })),
    };
  }

  async criarFilho(
    userId: string,
    eventoId: string,
    body: { titulo?: string; moduloIngressos?: boolean; moduloEstacionamento?: boolean; moduloTenda?: boolean; permitirVendaNoCaixaPai?: boolean },
  ) {
    await this.assertOwner(userId, eventoId);

    const pai = await this.prisma.event.findUnique({
      where: { id: eventoId },
      select: {
        id: true, organizationId: true, parentEventId: true,
        dateStart: true, dateEnd: true,
        venueName: true, venueId: true, city: true, state: true, street: true,
        streetNumber: true, neighborhood: true, complement: true, zipCode: true, capacity: true,
      },
    });
    if (!pai) throw new NotFoundException('Evento não encontrado');
    if (pai.parentEventId) {
      throw new BadRequestException('Este evento já é um evento filho — não é possível criar um filho dele.');
    }

    if (!body.titulo?.trim()) throw new BadRequestException('Nome é obrigatório');

    const herdaDadosDoPai = body.moduloTenda || body.moduloEstacionamento;

    const filho = await this.prisma.event.create({
      data: {
        organizationId: pai.organizationId, // sempre do pai, nunca do cliente
        parentEventId: pai.id,
        title: body.titulo.trim(),
        status: 'rascunho',
        createdBy: userId,
        moduloIngressos: body.moduloIngressos ?? true,
        moduloEstacionamento: body.moduloEstacionamento ?? false,
        moduloTenda: body.moduloTenda ?? false,
        permitirVendaNoCaixaPai: body.permitirVendaNoCaixaPai ?? true,
        // Tenda/Estacionamento herdam data e local do pai (editável depois)
        ...(herdaDadosDoPai
          ? {
              dateStart: pai.dateStart,
              dateEnd: pai.dateEnd,
              venueName: pai.venueName,
              venueId: pai.venueId,
              city: pai.city,
              state: pai.state,
              street: pai.street,
              streetNumber: pai.streetNumber,
              neighborhood: pai.neighborhood,
              complement: pai.complement,
              zipCode: pai.zipCode,
              capacity: pai.capacity,
            }
          : {}),
      },
      select: { id: true },
    });

    return { ok: true, id: filho.id };
  }
}
