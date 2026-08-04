import { Injectable } from '@nestjs/common';
import { FeeRulesService } from './fee-rules.service';
import { PrismaService } from '../prisma/prisma.service';

export interface SaldoBilheteria {
  ativo: boolean;
  bloqueio_ativo: boolean;
  retencao_pct: number;
  aviso_pct: number;
  meta_reserva: number;
  saldo_atual: number;
  aviso_disparado: boolean;
}

// Porte 1:1 de web/src/lib/saldoBilheteria.ts.
@Injectable()
export class SaldoBilheteriaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feeRules: FeeRulesService,
  ) {}

  calcularContribuicaoSaldo(total: number, taxaNormal: number, retencaoPct: number): number {
    const sobra = Math.max(0, total - taxaNormal);
    return Math.round(sobra * retencaoPct) / 100;
  }

  async buscarSaldoBilheteria(eventId: string): Promise<SaldoBilheteria | null> {
    const row = await this.prisma.saldoBilheteria.findUnique({
      where: { eventId },
      select: {
        ativo: true, bloqueioAtivo: true, retencaoPct: true, avisoPct: true,
        metaReserva: true, saldoAtual: true, avisoDisparado: true,
      },
    });
    if (!row) return null;
    return {
      ativo: row.ativo,
      bloqueio_ativo: row.bloqueioAtivo,
      retencao_pct: Number(row.retencaoPct),
      aviso_pct: Number(row.avisoPct),
      meta_reserva: Number(row.metaReserva),
      saldo_atual: Number(row.saldoAtual),
      aviso_disparado: row.avisoDisparado,
    };
  }

  // Soma a taxa devida sobre os ingressos ainda não vendidos do evento.
  async calcularMetaReserva(eventId: string): Promise<number> {
    const tickets = await this.prisma.eventTicket.findMany({
      where: { eventId },
      select: { id: true, price: true, quantity: true },
    });
    if (!tickets.length) return 0;

    const evento = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { organization: { select: { ownerId: true } } },
    });
    const ownerId = evento?.organization?.ownerId ?? null;

    const config = await this.feeRules.buscarConfigTaxaIngressosOnline();

    const orders = await this.prisma.order.findMany({ where: { eventId }, select: { id: true, status: true } });
    const validOrderIds = orders.filter((o) => o.status !== 'rejected' && o.status !== 'cancelled').map((o) => o.id);

    const vendidosPorTicket: Record<string, number> = {};
    if (validOrderIds.length) {
      const orderItems = await this.prisma.orderItem.findMany({
        where: { orderId: { in: validOrderIds } },
        select: { ticketId: true, quantity: true },
      });
      for (const oi of orderItems) {
        if (!oi.ticketId) continue;
        vendidosPorTicket[oi.ticketId] = (vendidosPorTicket[oi.ticketId] ?? 0) + oi.quantity;
      }
    }

    let meta = 0;
    for (const ticket of tickets) {
      const vendidos = vendidosPorTicket[ticket.id] ?? 0;
      const restante = Math.max(0, ticket.quantity - vendidos);
      const precoTotal = restante * Number(ticket.price ?? 0);
      if (restante === 0 || precoTotal <= 0) continue;

      meta += await this.feeRules.calcularTaxaPlataforma({
        eventoId: eventId,
        ownerId,
        total: precoTotal,
        ticketCount: restante,
        config,
      });
    }

    return Math.round(meta * 100) / 100;
  }

  async ativarSaldoBilheteria(eventId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
    const meta = await this.calcularMetaReserva(eventId);
    try {
      const rows = await this.prisma.$queryRaw<{ ativar_saldo_bilheteria: { error?: string } | null }[]>`
        SELECT ativar_saldo_bilheteria(${eventId}::uuid, ${userId}::uuid, ${meta})
      `;
      const data = rows[0]?.ativar_saldo_bilheteria;
      if (data?.error) return { ok: false, error: data.error };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async incrementarSaldoBilheteria(eventId: string, orderId: string, valorExtra: number): Promise<void> {
    if (valorExtra <= 0) return;
    const novaMeta = await this.calcularMetaReserva(eventId);
    await this.prisma.$queryRaw`
      SELECT incrementar_saldo_bilheteria(${eventId}::uuid, ${orderId}::uuid, ${valorExtra}, ${novaMeta})
    `;
  }

  // Chamada quando um pedido ONLINE é aprovado de verdade. Pedidos de
  // bilheteria (caixa_id preenchido) são ignorados — debitam de forma
  // síncrona na própria rota de venda.
  async processarSaldoAposAprovacao(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { eventId: true, total: true, caixaId: true },
    });
    if (!order?.eventId || order.caixaId) return;

    const saldo = await this.buscarSaldoBilheteria(order.eventId);
    if (!saldo?.ativo) return;

    const evento = await this.prisma.event.findUnique({
      where: { id: order.eventId },
      select: { organization: { select: { ownerId: true } } },
    });
    const ownerId = evento?.organization?.ownerId ?? null;

    const items = await this.prisma.orderItem.findMany({ where: { orderId }, select: { quantity: true } });
    const ticketCount = items.reduce((s, i) => s + i.quantity, 0);
    if (!ticketCount) return;

    const config = await this.feeRules.buscarConfigTaxaIngressosOnline();
    const taxaNormal = await this.feeRules.calcularTaxaPlataforma({
      eventoId: order.eventId,
      ownerId,
      total: Number(order.total),
      ticketCount,
      config,
    });
    const extra = this.calcularContribuicaoSaldo(Number(order.total), taxaNormal, saldo.retencao_pct);
    if (extra > 0) await this.incrementarSaldoBilheteria(order.eventId, orderId, extra);
  }

  // Chamar antes de confirmar uma venda de BILHETERIA (dinheiro ou pix
  // presencial). bloqueado:true = saldo insuficiente e bloqueio ligado.
  async debitarSaldoBilheteria(
    eventId: string,
    valor: number,
    orderId: string,
  ): Promise<{ bloqueado: boolean; saldoAtual?: number }> {
    try {
      const rows = await this.prisma.$queryRaw<{ debitar_saldo_bilheteria: { error?: string; saldo_atual?: number } | null }[]>`
        SELECT debitar_saldo_bilheteria(${eventId}::uuid, ${valor}, ${orderId}::uuid)
      `;
      const data = rows[0]?.debitar_saldo_bilheteria;
      if (data?.error === 'saldo_insuficiente') return { bloqueado: true, saldoAtual: Number(data.saldo_atual) };
      return { bloqueado: false, saldoAtual: data?.saldo_atual !== undefined ? Number(data.saldo_atual) : undefined };
    } catch {
      return { bloqueado: false };
    }
  }
}
