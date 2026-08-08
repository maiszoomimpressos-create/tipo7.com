import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Porte de web/src/app/minha-area/page.tsx (Fase 7.2, G11) — dashboard
// agregado cross-evento/cross-organização do promotor. Parecido com
// EventosAdminService.getDashboard (Fase 7.2, G7), mas cobre TODOS os
// eventos de TODAS as organizações do usuário, não um evento só.
@Injectable()
export class MinhaAreaService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string) {
    // Só organizações que o usuário é DONO (ownerId) — mesmo filtro do
    // original, não inclui sócio (organization_admins).
    const orgs = await this.prisma.organization.findMany({
      where: { ownerId: userId },
      select: { id: true, name: true, codigo: true, type: true },
    });

    if (orgs.length === 0) {
      return { semOrganizacao: true };
    }

    const org = orgs.find((o) => o.type === 'promotora') ?? orgs[0];
    const orgIds = orgs.map((o) => o.id);

    const eventos = await this.prisma.event.findMany({
      where: { organizationId: { in: orgIds }, parentEventId: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, status: true, dateStart: true, bannerUrl: true,
        category: true, moduloIngressos: true, moduloEstacionamento: true,
      },
    });

    const eventosOut = eventos.map((e) => ({
      id: e.id,
      title: e.title ?? 'Sem título',
      status: e.status ?? 'rascunho',
      date_start: e.dateStart,
      banner_url: e.bannerUrl,
      category: e.category,
      modulo_ingressos: e.moduloIngressos,
      modulo_estacionamento: e.moduloEstacionamento,
    }));

    const orgOut = { orgName: org.name ?? 'Minha organização', orgCodigo: org.codigo, orgTipo: org.type as 'promotora' | 'estabelecimento' | null };

    const eventoIds = eventos.map((e) => e.id);
    if (eventoIds.length === 0) {
      // Mesma otimização do original: sem eventos, nem tenta as queries pesadas.
      return {
        ...orgOut,
        eventos: [],
        kpis: { receita: 0, vendidos: 0, checkins: 0, totalEventos: 0 },
        tiposIngresso: [],
        compradores: [],
      };
    }

    const orders = await this.prisma.order.findMany({
      where: { eventId: { in: eventoIds }, status: 'approved' },
      select: { id: true, eventId: true, total: true, createdAt: true },
    });
    const orderIds = orders.map((o) => o.id);

    const items = orderIds.length
      ? await this.prisma.orderItem.findMany({
          where: { orderId: { in: orderIds } },
          select: {
            id: true, orderId: true, ticketId: true, quantity: true, unitPrice: true,
            ticket: { select: { id: true, name: true, eventId: true } },
          },
        })
      : [];
    const itemIds = items.map((i) => i.id);

    const holders = itemIds.length
      ? await this.prisma.ticketHolder.findMany({
          where: { orderItemId: { in: itemIds } },
          select: { orderItemId: true, slotNumber: true, fullName: true, email: true, cpf: true, birthDate: true },
        })
      : [];

    const ticketsRaw = orderIds.length
      ? await this.prisma.ticket.findMany({
          where: { orderId: { in: orderIds } },
          select: { orderId: true, orderItemId: true, slotNumber: true, status: true, validatedAt: true },
        })
      : [];

    const tiposIngressoRaw = await this.prisma.eventTicket.findMany({
      where: { eventId: { in: eventoIds } },
      select: { id: true, eventId: true, name: true },
    });

    // ── Mapas auxiliares (mesma lógica do original) ──
    const ticketMap = new Map<string, { status: string; validatedAt: Date | null }>();
    for (const t of ticketsRaw) {
      ticketMap.set(`${t.orderItemId}_${t.slotNumber}`, { status: t.status, validatedAt: t.validatedAt });
    }

    const orderEventMap = new Map<string, string>();
    const orderDateMap = new Map<string, Date>();
    for (const o of orders) {
      orderEventMap.set(o.id, o.eventId);
      orderDateMap.set(o.id, o.createdAt);
    }

    const eventoTitleMap = new Map<string, string>();
    for (const e of eventosOut) eventoTitleMap.set(e.id, e.title);

    const itemOrderMap = new Map<string, string>();
    const itemTicketNameMap = new Map<string, string>();
    const itemEventIdMap = new Map<string, string>();
    for (const item of items) {
      itemOrderMap.set(item.id, item.orderId);
      itemTicketNameMap.set(item.id, item.ticket?.name ?? 'Ingresso');
      itemEventIdMap.set(item.id, item.ticket?.eventId ?? orderEventMap.get(item.orderId) ?? '');
    }

    const compradores: Array<{
      nome: string | null; email: string | null; birth_date: Date | null;
      ticket_type: string; event_id: string; event_title: string;
      status: string; validated_at: Date | null; data_compra: Date | null;
    }> = [];
    for (const h of holders) {
      const orderId = itemOrderMap.get(h.orderItemId);
      if (!orderId) continue;
      const eventId = itemEventIdMap.get(h.orderItemId) ?? orderEventMap.get(orderId) ?? '';
      const tStatus = ticketMap.get(`${h.orderItemId}_${h.slotNumber}`);
      compradores.push({
        nome: h.fullName,
        email: h.email,
        // birthDate é @db.Date — serialização automática do NestJS chama
        // toISOString() (timestamp completo, meia-noite UTC). DashboardClient
        // faz `new Date(birth)` e lê mês/dia em horário LOCAL do browser —
        // no fuso do Brasil isso retrocede o dia, deslocando calcIdade() em
        // casos de borda (aniversário/virada de ano). Achado real 08/08/2026.
        birth_date: h.birthDate ? new Date(h.birthDate.toISOString().slice(0, 10) + 'T12:00:00.000Z') : null,
        ticket_type: itemTicketNameMap.get(h.orderItemId) ?? 'Ingresso',
        event_id: eventId,
        event_title: eventoTitleMap.get(eventId) ?? '',
        status: tStatus?.status ?? 'valid',
        validated_at: tStatus?.validatedAt ?? null,
        data_compra: orderDateMap.get(orderId) ?? null,
      });
    }

    const receita = orders.reduce((s, o) => s + Number(o.total), 0);
    const vendidos = items.reduce((s, i) => s + i.quantity, 0);
    const checkins = ticketsRaw.filter((t) => t.status === 'used').length;

    const tiposIngresso = tiposIngressoRaw.map((t) => ({ id: t.id, event_id: t.eventId, name: t.name }));

    return {
      ...orgOut,
      eventos: eventosOut,
      kpis: { receita, vendidos, checkins, totalEventos: eventosOut.length },
      tiposIngresso,
      compradores,
    };
  }

  // Porte de minha-area/marketing/page.tsx (Fase 7.2, G11). Bug real
  // corrigido: o original filtrava por `is_published`/`cover_url`, colunas
  // que não existem mais no schema (viraram `status`/`banner_url` faz
  // tempo) — a tela provavelmente já retornava lista vazia em produção.
  // Mantém a chave de resposta `cover_url` (não `banner_url`) porque é
  // o nome que o componente já lê — só a origem do dado é corrigida.
  async getEventosPublicados(userId: string) {
    const orgs = await this.prisma.organization.findMany({ where: { ownerId: userId }, select: { id: true } });
    const orgIds = orgs.map((o) => o.id);
    if (orgIds.length === 0) return { eventos: [] };

    const eventos = await this.prisma.event.findMany({
      where: { organizationId: { in: orgIds }, status: 'publicado' },
      orderBy: { dateStart: 'desc' },
      take: 20,
      select: { id: true, title: true, dateStart: true, venueName: true, city: true, bannerUrl: true },
    });

    return {
      eventos: eventos.map((e) => ({
        id: e.id, title: e.title, date_start: e.dateStart,
        venue_name: e.venueName, city: e.city, cover_url: e.bannerUrl,
      })),
    };
  }
}
