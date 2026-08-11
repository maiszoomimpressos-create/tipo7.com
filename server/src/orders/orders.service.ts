import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../common/whatsapp.service';

// Porte de web/src/app/meus-ingressos/page.tsx (Fase 7.2, G10) — resposta em
// snake_case pra bater 1:1 com o tipo Order já definido em MeusIngressosClient.tsx.
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async minhas(userId: string) {
    const EVENTO_SELECT = { id: true, title: true, dateStart: true, bannerUrl: true, venueName: true, city: true, state: true } as const;
    const ORDER_ITEM_SELECT = {
      id: true, quantity: true, unitPrice: true,
      ticket: { select: { id: true, name: true } },
      ticketHolders: { select: { slotNumber: true, fullName: true, cpf: true, email: true, birthDate: true, userId: true } },
      tickets: { select: { id: true, slotNumber: true, qrToken: true, status: true } },
    } as const;

    // caixaId: null — achado real (11/08/2026): pedido feito num caixa
    // presencial tem userId = o OPERADOR que vendeu (não tem como saber o
    // Tipo7 do cliente que compra no balcão; os dados dele ficam em
    // TicketHolder, não em Order.userId). Sem esse filtro, todo operador
    // via "meus ingressos" via como se fossem dele todos os ingressos que
    // ele já vendeu pra outras pessoas. Cliente real ainda pode ver o
    // ingresso dele normalmente via reivindicação por link (seção
    // holdersDeOutros abaixo, baseada em TicketHolder.userId — mecanismo
    // correto, não mexi nisso).
    const orders = await this.prisma.order.findMany({
      where: { userId, caixaId: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, status: true, total: true, createdAt: true, mpPaymentId: true,
        event: { select: EVENTO_SELECT },
        orderItems: { select: ORDER_ITEM_SELECT },
      },
    });

    // Pedido do usuário (09/08/2026): ingresso que essa pessoa reivindicou
    // via link (ou que o comprador vinculou à conta dela manualmente) —
    // mesmo sem ela ter comprado, o ingresso "é dela" e aparece aqui
    // também. Só os pedidos de OUTRO comprador (os meus já vêm acima).
    const orderIdsProprios = new Set(orders.map((o) => o.id));
    const holdersDeOutros = await this.prisma.ticketHolder.findMany({
      where: { userId, orderItem: { order: { userId: { not: userId } } } },
      select: {
        orderItem: {
          select: {
            id: true, quantity: true, unitPrice: true,
            ticket: { select: { id: true, name: true } },
            order: {
              select: {
                id: true, status: true, total: true, createdAt: true, mpPaymentId: true,
                event: { select: EVENTO_SELECT },
              },
            },
          },
        },
      },
    });

    // Agrupa os slots reivindicados por pedido (pode ter mais de um slot do
    // mesmo pedido vinculado à mesma conta, ex: casal reivindicando junto).
    const pedidosAlheiosPorId = new Map<string, { order: (typeof holdersDeOutros)[number]['orderItem']['order']; itemIds: Set<string> }>();
    for (const h of holdersDeOutros) {
      const orderId = h.orderItem.order.id;
      if (orderIdsProprios.has(orderId)) continue; // segurança, não deveria acontecer dado o where acima
      if (!pedidosAlheiosPorId.has(orderId)) pedidosAlheiosPorId.set(orderId, { order: h.orderItem.order, itemIds: new Set() });
      pedidosAlheiosPorId.get(orderId)!.itemIds.add(h.orderItem.id);
    }

    const orderIdsAlheios = [...pedidosAlheiosPorId.keys()];
    const orderItemsAlheios = orderIdsAlheios.length
      ? await this.prisma.orderItem.findMany({
          where: { orderId: { in: orderIdsAlheios } },
          select: { orderId: true, ...ORDER_ITEM_SELECT },
        })
      : [];

    // apenasMeuSlot: quando presente, corta ticket_holders/tickets pros
    // slots dessa pessoa só — usado nos pedidos ALHEIOS (achado real: sem
    // isso, quem reivindica 1 slot via link veria os dados dos OUTROS
    // portadores do mesmo item, um vazamento de privacidade real).
    function mapOrderItem(
      oi: { id: string; quantity: number; unitPrice: unknown; ticket: { id: string; name: string } | null; ticketHolders: { slotNumber: number; fullName: string | null; cpf: string | null; email: string | null; birthDate: Date | null; userId: string | null }[]; tickets: { id: string; slotNumber: number; qrToken: string; status: string }[] },
      apenasMeuSlot?: string,
    ) {
      const holdersVisiveis = apenasMeuSlot ? oi.ticketHolders.filter((th) => th.userId === apenasMeuSlot) : oi.ticketHolders;
      const slotsVisiveis = apenasMeuSlot ? new Set(holdersVisiveis.map((th) => th.slotNumber)) : null;
      const ticketsVisiveis = apenasMeuSlot ? oi.tickets.filter((t) => slotsVisiveis!.has(t.slotNumber)) : oi.tickets;

      return {
        id: oi.id,
        quantity: apenasMeuSlot ? holdersVisiveis.length : oi.quantity,
        unit_price: Number(oi.unitPrice),
        event_tickets: oi.ticket ? { id: oi.ticket.id, name: oi.ticket.name } : null,
        // birthDate é @db.Date — .toISOString() cru devolve timestamp
        // completo, que corrompe o parser "AAAA-MM-DD" do front (mesmo
        // bug já corrigido em profile.service.ts). Achado real 08/08/2026.
        ticket_holders: holdersVisiveis.map((th) => ({
          slot_number: th.slotNumber, full_name: th.fullName, cpf: th.cpf,
          email: th.email, birth_date: th.birthDate ? th.birthDate.toISOString().slice(0, 10) : null,
        })),
        tickets: ticketsVisiveis.map((t) => {
          const holder = oi.ticketHolders.find((th) => th.slotNumber === t.slotNumber);
          // Trava (pedido do usuário 09/08/2026): uma vez que o portador é
          // uma conta identificada DIFERENTE de quem está olhando agora,
          // só dá pra reenviar/imprimir — não editar. Dono dos dados (ou
          // o comprador, se ainda não tiver dono definido) continua livre.
          const locked = !!holder?.userId && holder.userId !== userId;
          return { id: t.id, slot_number: t.slotNumber, qr_token: t.qrToken, status: t.status, locked };
        }),
      };
    }

    const ordersMapeados = orders.map((o) => ({
      id: o.id,
      status: o.status,
      total: Number(o.total),
      created_at: o.createdAt,
      mp_payment_id: o.mpPaymentId,
      held: false,
      events: o.event
        ? { id: o.event.id, title: o.event.title, date_start: o.event.dateStart, banner_url: o.event.bannerUrl, venue_name: o.event.venueName, city: o.event.city, state: o.event.state }
        : null,
      order_items: o.orderItems.map((oi) => mapOrderItem(oi)),
    }));

    const ordersAlheiosMapeados = [...pedidosAlheiosPorId.entries()].map(([orderId, { order, itemIds }]) => ({
      id: order.id,
      status: order.status,
      total: Number(order.total),
      created_at: order.createdAt,
      mp_payment_id: order.mpPaymentId,
      held: true, // não é meu dinheiro — front não soma no total pago
      events: order.event
        ? { id: order.event.id, title: order.event.title, date_start: order.event.dateStart, banner_url: order.event.bannerUrl, venue_name: order.event.venueName, city: order.event.city, state: order.event.state }
        : null,
      // Só os itens onde essa pessoa é portador de algum slot — não expõe
      // os outros portadores/slots do pedido de quem comprou.
      order_items: orderItemsAlheios.filter((oi) => oi.orderId === orderId && itemIds.has(oi.id)).map((oi) => mapOrderItem(oi, userId)),
    }));

    return { orders: [...ordersMapeados, ...ordersAlheiosMapeados] };
  }

  // "Reenviar" — pedido lançado junto com a integração WhatsApp (08/08/2026):
  // hoje o ingresso só é mandado automaticamente uma vez, na aprovação do
  // pagamento (issue-tickets.service.ts) — se a mensagem não chegar por
  // qualquer motivo (número errado na hora, app do WhatsApp fora do ar,
  // etc.), a única forma de recuperar era eu reprocessar na mão. Reusa o
  // mesmo WhatsAppService e o mesmo formato de `details`.
  async reenviarWhatsapp(userId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        qrToken: true, slotNumber: true,
        orderItem: {
          select: {
            ticket: { select: { name: true } },
            ticketHolders: { select: { slotNumber: true, fullName: true, phone: true, userId: true } },
          },
        },
        order: {
          select: {
            userId: true,
            event: { select: { title: true, dateStart: true, venueName: true, city: true, state: true } },
          },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ingresso não encontrado');

    const holder = ticket.orderItem.ticketHolders.find((th) => th.slotNumber === ticket.slotNumber);
    // Pedido do usuário (09/08/2026): não é mais só o comprador — quem
    // reivindicou o portador (holder.userId) também pode reenviar o
    // PRÓPRIO ingresso, mesmo sem ter comprado.
    const souComprador = ticket.order.userId === userId;
    const souPortador = holder?.userId === userId;
    if (!souComprador && !souPortador) throw new NotFoundException('Ingresso não encontrado');

    // Prioriza o telefone do próprio portador (é ele quem vai usar o
    // ingresso) — só cai pro telefone de quem está pedindo o reenvio se o
    // portador não tiver telefone próprio salvo (preenchimento antigo,
    // manual, sem WhatsApp coletado).
    let telefone = holder?.phone ?? null;
    let nomeDestinatario = holder?.fullName ?? null;
    if (!telefone) {
      const profile = await this.prisma.profile.findUnique({ where: { id: userId }, select: { fullName: true, phone: true } });
      telefone = profile?.phone ?? null;
      nomeDestinatario = nomeDestinatario ?? profile?.fullName ?? null;
    }
    if (!telefone) throw new BadRequestException('Cadastre um telefone no seu perfil pra receber o ingresso por WhatsApp.');

    await this.whatsapp.enviar({
      to: telefone,
      recipientName: nomeDestinatario ?? 'Cliente',
      type: 'ingresso_emitido',
      qrData: ticket.qrToken,
      details: {
        nome_evento: ticket.order.event?.title ?? 'Evento',
        data: ticket.order.event?.dateStart?.toISOString() ?? '',
        ingresso: ticket.orderItem?.ticket?.name ?? 'Ingresso',
        local: ticket.order.event?.venueName ?? '',
        cidade: ticket.order.event?.city ?? '',
        estado: ticket.order.event?.state ?? '',
      },
    });

    return { ok: true };
  }
}
