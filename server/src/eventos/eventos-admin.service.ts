import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
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

  // ==== meu-acesso (Fase 7.2, G7) ====
  // Resolve a relação do usuário logado com o evento — dono (isOrgAdmin) ou
  // staff ativo (com cargo/permissões/portão designado). Serviço compartilhado
  // pras 5+ telas operacionais (trabalho, bilheteria, bilheteria/caixa,
  // estacionamento, scanner) que antes repetiam essa mesma checagem cada
  // uma com sua própria query direta ao Supabase. Cada tela decide sozinha
  // o que fazer com o resultado (redirect, filtrar por portão, etc.) — este
  // método só responde "quem é o usuário em relação a este evento".

  async getMeuAcesso(eventoId: string, userId: string) {
    const evento = await this.prisma.event.findUnique({
      where: { id: eventoId },
      select: {
        id: true, title: true, dateStart: true, venueName: true,
        city: true, state: true, bannerUrl: true, organizationId: true,
      },
    });
    if (!evento) return { evento: null, isOwner: false, staff: null };

    const isOwner = await this.orgAdmin.isOrgAdmin(evento.organizationId, userId);

    const staffRow = await this.prisma.eventStaff.findFirst({
      where: { eventId: eventoId, userId, status: 'active' },
      select: {
        id: true, portaoId: true,
        eventPosition: {
          select: { name: true, eventPositionPermissions: { select: { permission: true } } },
        },
      },
    });

    const staff = staffRow
      ? {
          id: staffRow.id,
          portaoId: staffRow.portaoId,
          positionName: staffRow.eventPosition?.name ?? null,
          permissions: (staffRow.eventPosition?.eventPositionPermissions ?? []).map((p) => p.permission),
        }
      : null;

    return { evento, isOwner, staff };
  }

  // ==== core (criar / editar / excluir) ====
  // Porte de web/src/app/criar-evento/TipoPessoaModal.tsx (criação),
  // EventoForm.tsx/ImagensClient.tsx/EventoPageClient.tsx/PainelEventosFilhos.tsx
  // (edição) e CriarEventoClient.tsx (exclusão) — o "criar evento" não tinha
  // rota nenhuma até aqui (era supabase.from('events').insert direto).

  async criarEvento(
    userId: string,
    body: { organizationId?: string; title?: string; moduloIngressos?: boolean; moduloEstacionamento?: boolean },
  ) {
    if (!body.organizationId) throw new BadRequestException('organizationId é obrigatório');
    if (!(await this.orgAdmin.isOrgAdmin(body.organizationId, userId))) throw new ForbiddenException('Sem permissão');

    const title = body.title?.trim();
    if (!title) throw new BadRequestException('Nome do evento é obrigatório');

    const moduloIngressos = body.moduloIngressos ?? true;
    const moduloEstacionamento = body.moduloEstacionamento ?? false;
    if (!moduloIngressos && !moduloEstacionamento) {
      throw new BadRequestException('O evento precisa ter ao menos um módulo ativo');
    }

    const evento = await this.prisma.event.create({
      data: {
        organizationId: body.organizationId,
        createdBy: userId,
        status: 'rascunho',
        title,
        moduloIngressos,
        moduloEstacionamento,
      },
      select: { id: true },
    });

    // Liga o selo informativo "Estacionamento" (event_attributes) quando o
    // módulo é ativado — mostra na página pública, sem lógica de venda atrás
    // (mesmo comportamento de vincularAtributoEstacionamento no client antigo).
    if (moduloEstacionamento) {
      const attr = await this.prisma.eventAttribute.findFirst({ where: { name: 'Estacionamento' }, select: { id: true } });
      if (attr) {
        await this.prisma.eventAttributeValue.upsert({
          where: { eventId_attributeId: { eventId: evento.id, attributeId: attr.id } },
          create: { eventId: evento.id, attributeId: attr.id },
          update: {},
        });
      }
    }

    return { ok: true, id: evento.id };
  }

  // Leitura pública — mesma info que a página do evento e o formulário do
  // organizador já buscavam sem guarda nenhuma. Resposta em snake_case pra
  // minimizar o diff nos consumidores que liam direto do Supabase antes.
  async getEventoCore(eventoId: string) {
    const evento = await this.prisma.event.findUnique({
      where: { id: eventoId },
      select: {
        id: true, title: true, description: true, category: true,
        dateStart: true, dateEnd: true, venueName: true, venueId: true,
        zipCode: true, street: true, streetNumber: true, neighborhood: true,
        city: true, state: true, complement: true, capacity: true, status: true,
        bannerUrl: true, galleryUrls: true, feeMode: true, paymentGateway: true,
        parentEventId: true, moduloIngressos: true, moduloEstacionamento: true,
        moduloTenda: true, permitirVendaNoCaixaPai: true, lat: true, lng: true,
        organizationId: true,
        organization: { select: { cnpj: true, ownerId: true } },
      },
    });
    if (!evento) throw new NotFoundException('Evento não encontrado');

    return {
      id: evento.id,
      title: evento.title,
      description: evento.description,
      category: evento.category,
      date_start: evento.dateStart ? evento.dateStart.toISOString() : null,
      date_end: evento.dateEnd ? evento.dateEnd.toISOString() : null,
      venue_name: evento.venueName,
      venue_id: evento.venueId,
      zip_code: evento.zipCode,
      street: evento.street,
      street_number: evento.streetNumber,
      neighborhood: evento.neighborhood,
      city: evento.city,
      state: evento.state,
      complement: evento.complement,
      capacity: evento.capacity,
      status: evento.status,
      banner_url: evento.bannerUrl,
      gallery_urls: evento.galleryUrls,
      fee_mode: evento.feeMode,
      payment_gateway: evento.paymentGateway,
      parent_event_id: evento.parentEventId,
      modulo_ingressos: evento.moduloIngressos,
      modulo_estacionamento: evento.moduloEstacionamento,
      modulo_tenda: evento.moduloTenda,
      permitir_venda_no_caixa_pai: evento.permitirVendaNoCaixaPai,
      lat: evento.lat,
      lng: evento.lng,
      organization_id: evento.organizationId,
      organizations: evento.organization
        ? { cnpj: evento.organization.cnpj, owner_id: evento.organization.ownerId }
        : null,
    };
  }

  // Locais já usados pelo promotor em outros eventos — sugestão imediata de
  // local ao criar/editar evento, sem precisar digitar nada.
  async getLocaisRecentes(userId: string, excluirId?: string) {
    const orgs = await this.prisma.organization.findMany({
      where: { ownerId: userId, type: 'promotora' },
      select: { id: true },
    });
    const orgIds = orgs.map((o) => o.id);
    if (orgIds.length === 0) return { locaisRecentes: [] };

    const eventos = await this.prisma.event.findMany({
      where: {
        organizationId: { in: orgIds },
        venueId: { not: null },
        ...(excluirId ? { id: { not: excluirId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        venue: {
          select: {
            id: true, name: true, city: true, state: true, zipCode: true,
            street: true, streetNumber: true, neighborhood: true, complement: true,
            lat: true, lng: true, capacity: true, hasParking: true, parkingSpots: true,
          },
        },
      },
    });

    const vistos = new Set<string>();
    const locaisRecentes: Array<{
      id: string; name: string; city: string | null; state: string | null;
      zipCode: string | null; street: string | null; streetNumber: string | null;
      neighborhood: string | null; complement: string | null;
      lat: number | null; lng: number | null; capacity: number | null;
      hasParking: boolean | null; parkingSpots: number | null;
    }> = [];

    for (const e of eventos) {
      const v = e.venue;
      if (!v || vistos.has(v.id)) continue;
      vistos.add(v.id);
      locaisRecentes.push({
        id: v.id, name: v.name, city: v.city, state: v.state,
        zipCode: v.zipCode, street: v.street, streetNumber: v.streetNumber,
        neighborhood: v.neighborhood, complement: v.complement,
        lat: v.lat != null ? Number(v.lat) : null,
        lng: v.lng != null ? Number(v.lng) : null,
        capacity: v.capacity, hasParking: v.hasParking, parkingSpots: v.parkingSpots,
      });
      if (locaisRecentes.length >= 6) break;
    }

    return { locaisRecentes };
  }

  async atualizarCore(
    userId: string,
    eventoId: string,
    body: {
      title?: string; description?: string | null; category?: string | null;
      dateStart?: string | null; dateEnd?: string | null;
      venueName?: string | null; venueId?: string | null;
      zipCode?: string | null; street?: string | null; streetNumber?: string | null;
      neighborhood?: string | null; city?: string | null; state?: string | null; complement?: string | null;
      capacity?: number | null; feeMode?: string; paymentGateway?: string;
      bannerUrl?: string | null; galleryUrls?: string[];
      lat?: number | null; lng?: number | null;
      permitirVendaNoCaixaPai?: boolean; status?: string;
    },
  ) {
    await this.assertOwner(userId, eventoId);

    // Essa rota nunca publica — publicar exige o checklist completo de
    // POST /eventos/:id/publicar. Só serve pro botão "Despublicar".
    if (body.status !== undefined && body.status !== 'rascunho') {
      throw new BadRequestException('Só é permitido reverter para rascunho por esta rota');
    }

    await this.prisma.event.update({
      where: { id: eventoId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.dateStart !== undefined ? { dateStart: body.dateStart ? new Date(body.dateStart) : null } : {}),
        ...(body.dateEnd !== undefined ? { dateEnd: body.dateEnd ? new Date(body.dateEnd) : null } : {}),
        ...(body.venueName !== undefined ? { venueName: body.venueName } : {}),
        ...(body.venueId !== undefined ? { venueId: body.venueId } : {}),
        ...(body.zipCode !== undefined ? { zipCode: body.zipCode } : {}),
        ...(body.street !== undefined ? { street: body.street } : {}),
        ...(body.streetNumber !== undefined ? { streetNumber: body.streetNumber } : {}),
        ...(body.neighborhood !== undefined ? { neighborhood: body.neighborhood } : {}),
        ...(body.city !== undefined ? { city: body.city } : {}),
        ...(body.state !== undefined ? { state: body.state } : {}),
        ...(body.complement !== undefined ? { complement: body.complement } : {}),
        ...(body.capacity !== undefined ? { capacity: body.capacity } : {}),
        ...(body.feeMode !== undefined ? { feeMode: body.feeMode } : {}),
        ...(body.paymentGateway !== undefined ? { paymentGateway: body.paymentGateway } : {}),
        ...(body.bannerUrl !== undefined ? { bannerUrl: body.bannerUrl } : {}),
        ...(body.galleryUrls !== undefined ? { galleryUrls: body.galleryUrls } : {}),
        ...(body.lat !== undefined ? { lat: body.lat } : {}),
        ...(body.lng !== undefined ? { lng: body.lng } : {}),
        ...(body.permitirVendaNoCaixaPai !== undefined ? { permitirVendaNoCaixaPai: body.permitirVendaNoCaixaPai } : {}),
        ...(body.status !== undefined ? { status: 'rascunho' as const } : {}),
      },
    });

    return { ok: true };
  }

  async excluirEvento(userId: string, eventoId: string) {
    await this.assertOwner(userId, eventoId);
    await this.prisma.event.delete({ where: { id: eventoId } });
    return { ok: true };
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

  // ==== dias (event_days + event_day_attractions + event_tickets) ====
  // Porte de web/src/app/criar-evento/[id]/ingressos/IngressosClient.tsx
  // (grava tudo de uma vez) + as leituras de evento/[id]/page.tsx,
  // criar-evento/[id]/{ingressos,publicar}/page.tsx.

  private async getDiasDoEvento(eventoId: string) {
    const [dias, ingressos] = await Promise.all([
      this.prisma.eventDay.findMany({
        where: { eventId: eventoId },
        orderBy: { dayNumber: 'asc' },
        include: { eventDayAttractions: { orderBy: { orderIndex: 'asc' } } },
      }),
      this.prisma.eventTicket.findMany({
        where: { eventId: eventoId },
        orderBy: { orderIndex: 'asc' },
      }),
    ]);

    return {
      dias: dias.map((d) => ({
        id: d.id,
        day_number: d.dayNumber,
        date: d.date.toISOString().slice(0, 10),
        start_time: d.startTime ? d.startTime.toISOString().slice(11, 16) : null,
        end_time: d.endTime ? d.endTime.toISOString().slice(11, 16) : null,
        banner_url: d.bannerUrl,
        event_day_attractions: d.eventDayAttractions.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          order_index: a.orderIndex,
          scheduled_time: a.scheduledTime ? a.scheduledTime.toISOString().slice(11, 16) : null,
          image_url: a.imageUrl,
        })),
      })),
      ingressos: ingressos.map((t) => ({
        id: t.id,
        event_day_id: t.eventDayId,
        name: t.name,
        description: t.description,
        price: Number(t.price),
        quantity: t.quantity,
        order_index: t.orderIndex,
      })),
    };
  }

  // Leitura pública (mesma info que já aparecia sem guarda nenhuma na
  // página pública do evento) — só a escrita (saveDias) exige dono.
  async getDias(eventoId: string) {
    const [proprio, filhosEvents] = await Promise.all([
      this.getDiasDoEvento(eventoId),
      this.prisma.event.findMany({ where: { parentEventId: eventoId }, select: { id: true } }),
    ]);

    const filhos: Record<string, { dias: unknown[]; ingressos: unknown[] }> = {};
    for (const f of filhosEvents) {
      filhos[f.id] = await this.getDiasDoEvento(f.id);
    }

    return { ...proprio, filhos };
  }

  async saveDias(
    userId: string,
    eventoId: string,
    body: {
      ticketMode?: 'individual' | 'pacote' | 'ambos';
      packageDiscountPct?: number;
      dateStart?: string;
      dateEnd?: string;
      dias?: Array<{
        id?: string;
        dayNumber: number;
        date: string;
        startTime?: string | null;
        endTime?: string | null;
        bannerUrl?: string | null;
        attractions?: Array<{ name: string; description?: string | null; orderIndex?: number; scheduledTime?: string | null; imageUrl?: string | null }>;
      }>;
      ingressos?: Array<{
        id?: string;
        eventDayId?: string | null;
        name: string;
        description?: string | null;
        price: number;
        quantity: number;
        orderIndex?: number;
      }>;
    },
  ) {
    await this.assertOwner(userId, eventoId);

    return this.prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id: eventoId },
        data: {
          ...(body.ticketMode ? { ticketMode: body.ticketMode } : {}),
          ...(body.packageDiscountPct !== undefined ? { packageDiscountPct: body.packageDiscountPct } : {}),
          ...(body.dateStart ? { dateStart: new Date(body.dateStart) } : {}),
          ...(body.dateEnd ? { dateEnd: new Date(body.dateEnd) } : {}),
        },
      });

      // dayNumber -> id real, pra front remapear ingressos que referenciavam
      // um dia recém-criado (mesma lógica do idPlaceholderParaReal original).
      const idPorDayNumber = new Map<number, string>();

      if (body.dias) {
        for (const dia of body.dias) {
          const diaDb = await tx.eventDay.upsert({
            where: { eventId_dayNumber: { eventId: eventoId, dayNumber: dia.dayNumber } },
            create: {
              eventId: eventoId,
              dayNumber: dia.dayNumber,
              date: new Date(dia.date),
              startTime: dia.startTime ? new Date(`1970-01-01T${dia.startTime}:00Z`) : null,
              endTime: dia.endTime ? new Date(`1970-01-01T${dia.endTime}:00Z`) : null,
              bannerUrl: dia.bannerUrl ?? null,
            },
            update: {
              date: new Date(dia.date),
              startTime: dia.startTime ? new Date(`1970-01-01T${dia.startTime}:00Z`) : null,
              endTime: dia.endTime ? new Date(`1970-01-01T${dia.endTime}:00Z`) : null,
              ...(dia.bannerUrl !== undefined ? { bannerUrl: dia.bannerUrl } : {}),
            },
            select: { id: true },
          });
          idPorDayNumber.set(dia.dayNumber, diaDb.id);

          await tx.eventDayAttraction.deleteMany({ where: { eventDayId: diaDb.id } });
          const atracoes = (dia.attractions ?? []).filter((a) => a.name?.trim());
          if (atracoes.length > 0) {
            await tx.eventDayAttraction.createMany({
              data: atracoes.map((a, i) => ({
                eventDayId: diaDb.id,
                name: a.name.trim(),
                description: a.description ?? null,
                orderIndex: a.orderIndex ?? i,
                scheduledTime: a.scheduledTime ? new Date(`1970-01-01T${a.scheduledTime}:00Z`) : null,
                imageUrl: a.imageUrl ?? null,
              })),
            });
          }
        }
      }

      const ingressosOut: Array<{ index: number; id: string; eventDayId: string | null }> = [];
      if (body.ingressos) {
        for (let i = 0; i < body.ingressos.length; i++) {
          const t = body.ingressos[i];
          if (!t.name?.trim()) continue;
          // eventDayId pode ser um dayNumber (string) do dia recém-criado no
          // mesmo save — resolve pro id real antes de gravar.
          const eventDayIdReal =
            t.eventDayId && idPorDayNumber.has(Number(t.eventDayId))
              ? (idPorDayNumber.get(Number(t.eventDayId)) as string)
              : (t.eventDayId ?? null);

          const data = {
            eventId: eventoId,
            eventDayId: eventDayIdReal,
            name: t.name.trim(),
            description: t.description ?? null,
            price: t.price,
            quantity: t.quantity,
            orderIndex: t.orderIndex ?? i,
          };

          const saved = t.id
            ? await tx.eventTicket.update({ where: { id: t.id }, data, select: { id: true } })
            : await tx.eventTicket.create({ data, select: { id: true } });

          ingressosOut.push({ index: i, id: saved.id, eventDayId: eventDayIdReal });
        }
      }

      return { ok: true, dias: Array.from(idPorDayNumber, ([dayNumber, id]) => ({ dayNumber, id })), ingressos: ingressosOut };
    });
  }

  // ==== atributos customizados (event_attributes / event_attribute_values) ====

  async getAtributosEvento(eventoId: string) {
    const [available, values] = await Promise.all([
      this.prisma.eventAttribute.findMany({
        where: { active: true },
        orderBy: { orderIndex: 'asc' },
        select: { id: true, name: true, icon: true, orderIndex: true },
      }),
      this.prisma.eventAttributeValue.findMany({
        where: { eventId: eventoId },
        select: { attributeId: true, valueJson: true },
      }),
    ]);

    return {
      available: available.map((a) => ({ id: a.id, name: a.name, icon: a.icon, order_index: a.orderIndex })),
      values: values.map((v) => ({ attribute_id: v.attributeId, value_json: v.valueJson })),
    };
  }

  async setAtributoValor(userId: string, eventoId: string, attributeId: string, valueJson: unknown) {
    await this.assertOwner(userId, eventoId);
    const jsonValue = valueJson === null ? Prisma.JsonNull : (valueJson as Prisma.InputJsonValue | undefined);
    await this.prisma.eventAttributeValue.upsert({
      where: { eventId_attributeId: { eventId: eventoId, attributeId } },
      create: { eventId: eventoId, attributeId, valueJson: jsonValue },
      update: jsonValue !== undefined ? { valueJson: jsonValue } : {},
    });
    return { ok: true };
  }

  async removeAtributoValor(userId: string, eventoId: string, attributeId: string) {
    await this.assertOwner(userId, eventoId);
    await this.prisma.eventAttributeValue.deleteMany({ where: { eventId: eventoId, attributeId } });
    return { ok: true };
  }
}
