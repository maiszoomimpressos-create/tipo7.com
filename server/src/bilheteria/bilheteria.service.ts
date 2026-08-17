import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { AuditService } from '../common/audit.service';
import { FeeRulesService } from '../common/fee-rules.service';
import { gerarQrToken } from '../common/qr-token.util';
import { IssueTicketsService } from '../common/issue-tickets.service';
import { MpTokenService } from '../common/mp-token.service';
import { PedidoAtomicoService } from '../common/pedido-atomico.service';
import { SaldoBilheteriaService } from '../common/saldo-bilheteria.service';
import { OrgAdminService } from '../org-admin/org-admin.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BilheteriaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAdmin: OrgAdminService,
    private readonly feeRules: FeeRulesService,
    private readonly saldoBilheteria: SaldoBilheteriaService,
    private readonly mpToken: MpTokenService,
    private readonly audit: AuditService,
    private readonly pedidoAtomico: PedidoAtomicoService,
    private readonly issueTickets: IssueTicketsService,
  ) {}

  private async temPermissaoVenderNoEvento(userId: string, eventoId: string): Promise<boolean> {
    const staff = await this.prisma.eventStaff.findFirst({
      where: { eventId: eventoId, userId, status: 'active' },
      select: { eventPosition: { select: { eventPositionPermissions: { select: { permission: true } } } } },
    });
    if (!staff) return false;
    return (staff.eventPosition?.eventPositionPermissions ?? []).some((p) => p.permission === 'vender_ingresso');
  }

  // Equipe convidada no PAI também vende ingresso do filho quando ele usa o
  // caixa compartilhado — sem precisar de convite duplicado por filho.
  private async checkPermissaoBilheteria(userId: string, eventoId: string): Promise<{ ok: boolean; ownerId: string | null }> {
    const evento = await this.prisma.event.findUnique({
      where: { id: eventoId },
      select: { organizationId: true, parentEventId: true },
    });
    if (!evento) return { ok: false, ownerId: null };

    const org = await this.prisma.organization.findUnique({ where: { id: evento.organizationId }, select: { ownerId: true } });

    if (await this.orgAdmin.isOrgAdmin(evento.organizationId, userId)) return { ok: true, ownerId: org?.ownerId ?? null };

    let temPerm = await this.temPermissaoVenderNoEvento(userId, eventoId);
    if (!temPerm && evento.parentEventId) {
      temPerm = await this.temPermissaoVenderNoEvento(userId, evento.parentEventId);
    }
    return { ok: temPerm, ownerId: org?.ownerId ?? null };
  }

  // GET /bilheteria/caixa/:caixaId/vendas-recentes — pedido do usuário
  // (11/08/2026): impressora falhou numa venda de 4 ingressos e não saiu
  // nada, sem essa lista não tinha como reimprimir sem vender de novo (o
  // que duplicaria o pedido e o débito de estoque). Devolve os últimos 20
  // pedidos aprovados desse caixa, com os dados que a tela de impressão já
  // sabe renderizar (mesmo formato de tickets que vender()/confirmarPix()
  // devolvem) — reimprimir é só recarregar isso na tela, não cria nada novo.
  async vendasRecentes(userId: string, caixaId: string) {
    const caixa = await this.prisma.caixa.findUnique({
      where: { id: caixaId },
      select: { operadorId: true, eventoId: true },
    });
    if (!caixa) throw new NotFoundException('Caixa não encontrado');

    const isOperador = caixa.operadorId === userId;
    if (!isOperador) {
      const { ok } = await this.checkPermissaoBilheteria(userId, caixa.eventoId);
      if (!ok) throw new ForbiddenException('Sem permissão para este caixa');
    }

    const orders = await this.prisma.order.findMany({
      where: { caixaId, status: 'approved' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        orderItems: {
          select: {
            quantity: true,
            ticket: { select: { name: true } },
            tickets: { select: { id: true, slotNumber: true, qrToken: true }, orderBy: { slotNumber: 'asc' } },
            ticketHolders: { select: { fullName: true, cpf: true }, take: 1 },
          },
        },
      },
    });

    return orders.map((o) => {
      const item = o.orderItems[0];
      const holder = item?.ticketHolders[0];
      return {
        orderId:    o.id,
        criadoEm:   o.createdAt,
        ticketName: item?.ticket?.name ?? 'Ingresso',
        quantidade: item?.quantity ?? 0,
        portador:   holder?.fullName ?? null,
        cpf:        holder?.cpf ?? null,
        tickets: (item?.tickets ?? []).map((t) => ({ id: t.id, slot_number: t.slotNumber, qr_token: t.qrToken })),
      };
    });
  }

  // POST /bilheteria/vender — venda presencial paga em dinheiro/cartão.
  async vender(
    userId: string,
    ip: string,
    body: {
      eventoId?: string; ticketId?: string; quantidade?: number; caixaId?: string; metodoPagamento?: string;
      comprador?: { nome?: string; cpf?: string; telefone?: string; dataNascimento?: string };
    },
  ) {
    const { eventoId, ticketId, quantidade, caixaId, metodoPagamento, comprador = {} } = body;
    if (!eventoId || !ticketId || !quantidade) throw new BadRequestException('Dados incompletos');

    const { ok } = await this.checkPermissaoBilheteria(userId, eventoId);
    if (!ok) throw new ForbiddenException('Sem permissão para este evento');

    const ticket = await this.prisma.eventTicket.findFirst({
      where: { id: ticketId, eventId: eventoId },
      select: { id: true, name: true, price: true },
    });
    if (!ticket) throw new NotFoundException('Ingresso não encontrado');

    const resultado = await this.pedidoAtomico.criar(userId, eventoId, [
      { ticket_id: ticketId, quantity: quantidade, unit_price: Number(ticket.price ?? 0) },
    ]);
    if (resultado.error === 'sem_estoque') {
      throw new ConflictException(`Ingresso esgotado. Restam ${resultado.disponivel ?? 0}.`);
    }
    if (!resultado.order_id) throw new BadRequestException('Erro ao criar pedido');
    const orderId = resultado.order_id;

    const evento = await this.prisma.event.findUnique({
      where: { id: eventoId },
      select: { organization: { select: { ownerId: true } } },
    });
    const ownerId = evento?.organization?.ownerId ?? null;

    const totalVenda = Number(ticket.price ?? 0) * quantidade;
    const config = await this.feeRules.buscarConfigTaxaIngressosOnline();
    const taxaVenda = await this.feeRules.calcularTaxaPlataforma({ eventoId, ownerId, total: totalVenda, ticketCount: quantidade, config });

    const { bloqueado } = await this.saldoBilheteria.debitarSaldoBilheteria(eventoId, taxaVenda, orderId);
    if (bloqueado) {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: 'cancelled' } });
      throw new ConflictException('Saldo de bilheteria insuficiente pra cobrir a taxa desta venda. Peça ao promotor pra reforçar o saldo.');
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'approved', paymentMethod: metodoPagamento ?? 'dinheiro', caixaId: caixaId ?? null },
    });

    const orderItem = await this.prisma.orderItem.findFirst({ where: { orderId }, select: { id: true } });
    if (!orderItem) throw new BadRequestException('Erro ao buscar item do pedido');

    const ticketRows = Array.from({ length: quantidade }, (_, i) => ({
      orderId, orderItemId: orderItem.id, slotNumber: i + 1, qrToken: gerarQrToken(),
    }));
    await this.prisma.ticket.createMany({ data: ticketRows });
    const tickets = await this.prisma.ticket.findMany({
      where: { orderItemId: orderItem.id },
      select: { id: true, slotNumber: true, qrToken: true },
      orderBy: { slotNumber: 'asc' },
    });

    await this.prisma.ticketHolder.createMany({
      data: tickets.map((t) => ({
        orderItemId: orderItem.id,
        slotNumber: t.slotNumber,
        fullName: comprador.nome?.trim() || 'Consumidor',
        cpf: comprador.cpf?.trim() || null,
        phone: comprador.telefone?.trim() || null,
        birthDate: comprador.dataNascimento?.trim() ? new Date(comprador.dataNascimento.trim()) : null,
      })),
      skipDuplicates: true,
    });

    await this.audit.logAudit({
      userId, action: 'venda_presencial', resourceType: 'order', resourceId: orderId,
      details: { eventoId, ticketId, quantidade, comprador: comprador.nome || 'Consumidor', metodoPagamento: metodoPagamento ?? 'dinheiro' },
      ip,
    });

    return {
      ok: true, orderId,
      tickets: tickets.map((t) => ({ id: t.id, slot_number: t.slotNumber, qr_token: t.qrToken })),
      ticketName: ticket.name,
    };
  }

  // POST /bilheteria/holders
  async salvarHolders(userId: string, body: { orderId?: string; comprador?: { nome?: string; cpf?: string; telefone?: string; nascimento?: string } }) {
    const { orderId, comprador = {} } = body;
    if (!orderId) throw new BadRequestException('orderId obrigatório');

    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId }, select: { id: true, status: true } });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.status !== 'approved') throw new ConflictException('Pedido não aprovado');

    const orderItem = await this.prisma.orderItem.findFirst({ where: { orderId }, select: { id: true } });
    if (!orderItem) throw new BadRequestException('Item do pedido não encontrado');

    const tickets = await this.prisma.ticket.findMany({ where: { orderId }, select: { id: true, slotNumber: true } });
    if (!tickets.length) throw new BadRequestException('Ingressos não encontrados');

    await this.prisma.ticketHolder.createMany({
      data: tickets.map((t) => ({
        orderItemId: orderItem.id,
        slotNumber: t.slotNumber,
        fullName: comprador.nome?.trim() || null,
        cpf: comprador.cpf || null,
        phone: comprador.telefone || null,
        birthDate: comprador.nascimento ? new Date(comprador.nascimento) : null,
      })),
      skipDuplicates: true,
    });

    // Achado real (17/08/2026): quem recebia o WhatsApp do ingresso numa
    // venda de balcão era o CAIXA (o `issueTickets()` automático do webhook
    // usa `order.userId`, que aqui é o operador, não o comprador — ver
    // notificarCompradorPresencial() em issue-tickets.service.ts). Este é o
    // ponto certo pra avisar de verdade: já temos telefone real de "Dados do
    // comprador" e os tickets já existem nesse momento.
    if (comprador.telefone) {
      try {
        await this.issueTickets.notificarCompradorPresencial(orderId, {
          nome: comprador.nome?.trim() || 'Cliente',
          telefone: comprador.telefone,
        });
      } catch {
        // best-effort — não trava o fluxo de venda por falha no WhatsApp
      }
    }

    return { ok: true };
  }

  // POST /bilheteria/cancelar-pix
  async cancelarPix(userId: string, body: { orderId?: string }) {
    if (!body.orderId) throw new BadRequestException('orderId obrigatório');

    const order = await this.prisma.order.findFirst({ where: { id: body.orderId, userId }, select: { id: true, status: true } });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.status !== 'pending') return { ok: true };

    await this.prisma.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
    return { ok: true };
  }

  // POST /bilheteria/pix — gera QR PIX via Mercado Pago pra venda presencial.
  async criarPix(
    userId: string,
    body: { eventoId?: string; ticketId?: string; quantidade?: number; caixaId?: string; comprador?: { nome?: string; cpf?: string } },
  ) {
    const { eventoId, ticketId, quantidade, caixaId, comprador } = body;
    if (!eventoId || !ticketId || !quantidade) throw new BadRequestException('Dados incompletos');

    const { ok, ownerId } = await this.checkPermissaoBilheteria(userId, eventoId);
    if (!ok) throw new ForbiddenException('Sem permissão para este evento');
    if (!ownerId) throw new NotFoundException('Promotor não encontrado');

    const mpToken = await this.mpToken.getMpToken(ownerId);
    if (!mpToken) throw new UnprocessableEntityException('Promotor não tem conta Mercado Pago conectada.');

    const ticket = await this.prisma.eventTicket.findFirst({ where: { id: ticketId, eventId: eventoId }, select: { id: true, name: true, price: true } });
    if (!ticket) throw new NotFoundException('Ingresso não encontrado');

    const total = Number(ticket.price ?? 0) * quantidade;
    if (total <= 0) throw new BadRequestException('PIX não disponível para ingressos gratuitos.');

    const resultado = await this.pedidoAtomico.criar(userId, eventoId, [
      { ticket_id: ticketId, quantity: quantidade, unit_price: Number(ticket.price ?? 0) },
    ]);
    if (resultado.error === 'sem_estoque') throw new ConflictException(`Quantidade indisponível. Restam ${resultado.disponivel ?? 0}.`);
    if (!resultado.order_id) throw new BadRequestException('Erro ao criar pedido');
    const orderId = resultado.order_id;

    const config = await this.feeRules.buscarConfigTaxaIngressosOnline();
    const taxaPixVenda = await this.feeRules.calcularTaxaPlataforma({ eventoId, ownerId, total, ticketCount: quantidade, config });

    const { bloqueado } = await this.saldoBilheteria.debitarSaldoBilheteria(eventoId, taxaPixVenda, orderId);
    if (bloqueado) {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: 'cancelled' } });
      throw new ConflictException('Saldo de bilheteria insuficiente pra cobrir a taxa desta venda. Peça ao promotor pra reforçar o saldo.');
    }

    const mpClient = new MercadoPagoConfig({ accessToken: mpToken });
    const payment = new Payment(mpClient);

    try {
      const eventoInfo = await this.prisma.event.findUnique({ where: { id: eventoId }, select: { title: true } });
      const dateOfExpiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const compradorCpf = (comprador?.cpf ?? '').replace(/\D/g, '');

      const result = await payment.create({
        body: {
          transaction_amount: total,
          description: `Bilheteria — ${eventoInfo?.title ?? 'Evento'}`.slice(0, 255),
          statement_descriptor: 'TIPO7.COM',
          payment_method_id: 'pix',
          date_of_expiration: dateOfExpiration,
          payer: {
            email: `bilheteria+${orderId.slice(0, 8)}@tipo7.com`,
            ...(compradorCpf.length === 11 && { identification: { type: 'CPF', number: compradorCpf } }),
          },
          additional_info: {
            items: [{
              id: ticketId, title: ticket.name,
              description: `Ingresso — ${eventoInfo?.title ?? 'Evento'}`.slice(0, 255),
              quantity: quantidade, unit_price: Number(ticket.price ?? 0),
            }],
          },
          notification_url: 'https://www.tipo7.com/api/webhooks/mercadopago',
          external_reference: orderId,
          application_fee: taxaPixVenda > 0 ? taxaPixVenda : undefined,
        },
      });

      const qrCode = result.point_of_interaction?.transaction_data?.qr_code ?? null;
      const qrCodeBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
      const expiresAt = result.date_of_expiration ?? null;

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          mpPaymentId: String(result.id),
          pixQrCode: qrCode,
          pixQrCodeBase64: qrCodeBase64,
          pixExpiresAt: expiresAt ? new Date(expiresAt) : null,
          paymentMethod: 'pix',
          caixaId: caixaId ?? null,
        },
      });

      return { orderId, qrCode, qrCodeBase64, expiresAt, total };
    } catch (err) {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: 'cancelled' } });
      throw new BadRequestException('Falha ao gerar QR PIX. Tente outro método de pagamento.');
    }
  }

  // POST /bilheteria/pix/confirmar — confirmação manual (caixa vê pagamento no celular).
  async confirmarPix(userId: string, ip: string, body: { orderId?: string; comprador?: { nome?: string; cpf?: string } }) {
    const { orderId, comprador } = body;
    if (!orderId) throw new BadRequestException('orderId obrigatório');

    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId }, select: { id: true, status: true, eventId: true } });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.status !== 'pending' && order.status !== 'approved') throw new ConflictException('Pedido não está pendente');

    if (order.status === 'approved') {
      const existingTickets = await this.prisma.ticket.findMany({ where: { orderId }, select: { id: true, slotNumber: true, qrToken: true } });
      const orderItem = await this.prisma.orderItem.findFirst({ where: { orderId }, select: { ticketId: true } });
      const ticketType = orderItem?.ticketId
        ? await this.prisma.eventTicket.findUnique({ where: { id: orderItem.ticketId }, select: { name: true } })
        : null;
      return {
        ok: true,
        tickets: existingTickets.map((t) => ({ id: t.id, slot_number: t.slotNumber, qr_token: t.qrToken })),
        ticketName: ticketType?.name ?? 'Ingresso',
      };
    }

    await this.prisma.order.update({ where: { id: orderId }, data: { status: 'approved', paymentMethod: 'pix' } });

    const orderItem = await this.prisma.orderItem.findFirst({ where: { orderId }, select: { id: true, quantity: true, ticketId: true } });
    if (!orderItem) throw new BadRequestException('Item do pedido não encontrado');

    const ticketType = orderItem.ticketId
      ? await this.prisma.eventTicket.findUnique({ where: { id: orderItem.ticketId }, select: { name: true } })
      : null;

    const ticketRows = Array.from({ length: orderItem.quantity }, (_, i) => ({
      orderId, orderItemId: orderItem.id, slotNumber: i + 1, qrToken: gerarQrToken(),
    }));
    await this.prisma.ticket.createMany({ data: ticketRows, skipDuplicates: true });
    const tickets = await this.prisma.ticket.findMany({
      where: { orderItemId: orderItem.id },
      select: { id: true, slotNumber: true, qrToken: true },
      orderBy: { slotNumber: 'asc' },
    });

    if (comprador?.nome || comprador?.cpf) {
      await this.prisma.ticketHolder.createMany({
        data: tickets.map((t) => ({
          orderItemId: orderItem.id,
          slotNumber: t.slotNumber,
          fullName: comprador.nome?.trim() || 'Consumidor',
          cpf: comprador.cpf?.replace(/\D/g, '') || null,
        })),
        skipDuplicates: true,
      });
    }

    await this.audit.logAudit({
      userId, action: 'venda_presencial_pix', resourceType: 'order', resourceId: orderId,
      details: { eventoId: order.eventId, quantidade: orderItem.quantity, confirmacao: 'manual' },
      ip,
    });

    return {
      ok: true,
      tickets: tickets.map((t) => ({ id: t.id, slot_number: t.slotNumber, qr_token: t.qrToken })),
      ticketName: ticketType?.name ?? 'Ingresso',
    };
  }

  // GET /bilheteria/pix/:orderId — polling de status.
  async statusPix(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, status: true, total: true, pixQrCode: true, pixQrCodeBase64: true, pixExpiresAt: true, mpPaymentId: true, eventId: true },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');

    let status = order.status;

    if (status === 'approved') {
      return { status, total: order.total };
    }

    if (status === 'pending' && order.mpPaymentId) {
      try {
        const evento = await this.prisma.event.findUnique({ where: { id: order.eventId }, select: { organizationId: true } });
        const org = evento ? await this.prisma.organization.findUnique({ where: { id: evento.organizationId }, select: { ownerId: true } }) : null;

        if (org?.ownerId) {
          const mpToken = await this.mpToken.getMpToken(org.ownerId);
          if (mpToken) {
            const mpClient = new MercadoPagoConfig({ accessToken: mpToken });
            const payment = new Payment(mpClient);
            const mpData = await payment.get({ id: order.mpPaymentId });

            if (mpData.status === 'approved') {
              await this.prisma.order.update({ where: { id: orderId }, data: { status: 'approved' } });
              status = 'approved';
            }
          }
        }
      } catch {
        // Falha na consulta ao MP não deve quebrar o polling — cliente tenta de novo.
      }
    }

    return {
      status,
      total: order.total,
      qrCode: order.pixQrCode,
      qrCodeBase64: order.pixQrCodeBase64,
      expiresAt: order.pixExpiresAt,
    };
  }
}
