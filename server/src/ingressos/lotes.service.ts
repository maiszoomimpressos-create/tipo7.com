import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrgAdminService } from '../org-admin/org-admin.service';
import { PrismaService } from '../prisma/prisma.service';

// Lote de ingresso (20/08/2026, pedido do usuário — ver
// project_lote_ingressos na memória). Faixas de preço sucessivas dentro do
// MESMO tipo de ingresso (Pista 1º lote R$50/30un, 2º lote R$70/50un...).
//
// Decisão de design deliberada: checkout.service.ts NUNCA lê essa tabela —
// ele sempre lê EventTicket.price como já fazia antes disso existir. Essa
// classe é a única que grava em EventTicket.price/quantity, recalculando
// qual lote está "ativo" (resincronizar()) toda vez que um lote muda, e um
// cron (ver IngressosLotesCronService) pega o resto: transição por venda
// que cruzou a fronteira de quantidade sem ninguém mexer no lote, e
// transição por data. Prefere um atraso de até um tick do cron a arriscar
// tocar nos 5 blocos quase-duplicados de cobrança (MP/PagBank × Pix/Cartão).
@Injectable()
export class LotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAdmin: OrgAdminService,
  ) {}

  private async assertOwnerDoTicket(userId: string, ticketId: string) {
    const ticket = await this.prisma.eventTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, eventId: true, event: { select: { organizationId: true, capacity: true } } },
    });
    if (!ticket) throw new NotFoundException('Ingresso não encontrado');
    if (!(await this.orgAdmin.isOrgAdmin(ticket.event.organizationId, userId))) throw new ForbiddenException('Sem permissão');
    return ticket;
  }

  async listar(userId: string, ticketId: string) {
    await this.assertOwnerDoTicket(userId, ticketId);
    return this.prisma.ticketLote.findMany({ where: { ticketId }, orderBy: { ordem: 'asc' } });
  }

  async criar(userId: string, ticketId: string, body: { price?: number; quantity?: number; dataCorte?: string | null }) {
    const ticket = await this.assertOwnerDoTicket(userId, ticketId);
    if (body.price === undefined || body.price < 0) throw new BadRequestException('Preço inválido');
    if (!body.quantity || body.quantity <= 0) throw new BadRequestException('Quantidade precisa ser maior que zero');

    await this.assertCapacidade(ticket.eventId, ticketId, ticket.event.capacity, body.quantity);

    const maxOrdem = await this.prisma.ticketLote.aggregate({ where: { ticketId }, _max: { ordem: true } });
    await this.prisma.ticketLote.create({
      data: {
        ticketId,
        ordem: (maxOrdem._max.ordem ?? 0) + 1,
        price: body.price,
        quantity: body.quantity,
        dataCorte: body.dataCorte ? new Date(body.dataCorte) : null,
      },
    });
    await this.resincronizar(ticketId);
    return { ok: true };
  }

  async atualizar(userId: string, loteId: string, body: { price?: number; quantity?: number; dataCorte?: string | null }) {
    const lote = await this.prisma.ticketLote.findUnique({ where: { id: loteId } });
    if (!lote) throw new NotFoundException('Lote não encontrado');
    const ticket = await this.assertOwnerDoTicket(userId, lote.ticketId);

    if (body.quantity !== undefined) {
      if (body.quantity <= 0) throw new BadRequestException('Quantidade precisa ser maior que zero');
      await this.assertCapacidade(ticket.eventId, lote.ticketId, ticket.event.capacity, body.quantity, loteId);
    }

    await this.prisma.ticketLote.update({
      where: { id: loteId },
      data: {
        ...(body.price !== undefined ? { price: body.price } : {}),
        ...(body.quantity !== undefined ? { quantity: body.quantity } : {}),
        ...(body.dataCorte !== undefined ? { dataCorte: body.dataCorte ? new Date(body.dataCorte) : null } : {}),
      },
    });
    await this.resincronizar(lote.ticketId);
    return { ok: true };
  }

  async excluir(userId: string, loteId: string) {
    const lote = await this.prisma.ticketLote.findUnique({ where: { id: loteId } });
    if (!lote) throw new NotFoundException('Lote não encontrado');
    await this.assertOwnerDoTicket(userId, lote.ticketId);

    await this.prisma.ticketLote.delete({ where: { id: loteId } });
    await this.resincronizar(lote.ticketId);
    return { ok: true };
  }

  // Mesma regra de capacidade que já existia em ingressos.service.ts >
  // atualizar() — soma de TODOS os tipos de ingresso do evento não pode
  // passar da capacidade total. excluirLoteId: ao editar um lote existente,
  // não conta a quantidade antiga dele mesmo na soma (senão comparava
  // contra si mesmo).
  private async assertCapacidade(eventId: string, ticketId: string, capacity: number | null, novaQuantidadeLote: number, excluirLoteId?: string) {
    if (!capacity) return;

    const outrosTickets = await this.prisma.eventTicket.findMany({
      where: { eventId, id: { not: ticketId } },
      select: { quantity: true },
    });
    const somaOutrosTickets = outrosTickets.reduce((s, t) => s + (t.quantity ?? 0), 0);

    const outrosLotesDesseTicket = await this.prisma.ticketLote.findMany({
      where: { ticketId, ...(excluirLoteId ? { id: { not: excluirLoteId } } : {}) },
      select: { quantity: true },
    });
    const somaOutrosLotes = outrosLotesDesseTicket.reduce((s, l) => s + l.quantity, 0);

    const total = somaOutrosTickets + somaOutrosLotes + novaQuantidadeLote;
    if (total > capacity) {
      throw new BadRequestException(`Capacidade insuficiente. Máximo disponível pra esse lote: ${capacity - somaOutrosTickets - somaOutrosLotes}.`);
    }
  }

  // Núcleo do design: recalcula qual lote está ativo (primeiro, em ordem,
  // que não esgotou por quantidade nem passou da data de corte) e grava o
  // preço dele em EventTicket.price. quantity do ticket vira a soma de
  // todos os lotes (é essa soma que checkout/capacidade usam pra saber
  // quanto tem disponível no total, sem se importar com qual lote).
  async resincronizar(ticketId: string): Promise<void> {
    const lotes = await this.prisma.ticketLote.findMany({ where: { ticketId }, orderBy: { ordem: 'asc' } });
    if (lotes.length === 0) return; // sem lote — ticket.price/quantity continuam editáveis direto, como sempre foi

    const vendidosRows = await this.prisma.orderItem.findMany({
      where: { ticketId, order: { status: 'approved' } },
      select: { quantity: true },
    });
    const vendidos = vendidosRows.reduce((s, r) => s + r.quantity, 0);

    const agora = new Date();
    let acumulado = 0;
    let ativo = lotes[lotes.length - 1]; // fallback: todos esgotados/expirados, fica no último (não afeta disponibilidade real — isso quem trava é quantity-vendidos)
    for (const lote of lotes) {
      const expirouPorData = lote.dataCorte !== null && lote.dataCorte <= agora;
      const esgotouPorQuantidade = vendidos >= acumulado + lote.quantity;
      if (!expirouPorData && !esgotouPorQuantidade) {
        ativo = lote;
        break;
      }
      acumulado += lote.quantity;
    }

    const quantityTotal = lotes.reduce((s, l) => s + l.quantity, 0);
    await this.prisma.eventTicket.update({ where: { id: ticketId }, data: { price: ativo.price, quantity: quantityTotal } });
  }
}
