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
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, status: true, total: true, createdAt: true, mpPaymentId: true,
        event: {
          select: { id: true, title: true, dateStart: true, bannerUrl: true, venueName: true, city: true, state: true },
        },
        orderItems: {
          select: {
            id: true, quantity: true, unitPrice: true,
            ticket: { select: { id: true, name: true } },
            ticketHolders: { select: { slotNumber: true, fullName: true, cpf: true, email: true, birthDate: true } },
            tickets: { select: { id: true, slotNumber: true, qrToken: true, status: true } },
          },
        },
      },
    });

    return {
      orders: orders.map((o) => ({
        id: o.id,
        status: o.status,
        total: Number(o.total),
        created_at: o.createdAt,
        mp_payment_id: o.mpPaymentId,
        events: o.event
          ? {
              id: o.event.id, title: o.event.title, date_start: o.event.dateStart,
              banner_url: o.event.bannerUrl, venue_name: o.event.venueName,
              city: o.event.city, state: o.event.state,
            }
          : null,
        order_items: o.orderItems.map((oi) => ({
          id: oi.id,
          quantity: oi.quantity,
          unit_price: Number(oi.unitPrice),
          event_tickets: oi.ticket ? { id: oi.ticket.id, name: oi.ticket.name } : null,
          // birthDate é @db.Date — .toISOString() cru devolve timestamp
          // completo, que corrompe o parser "AAAA-MM-DD" do front (mesmo
          // bug já corrigido em profile.service.ts). Achado real 08/08/2026.
          ticket_holders: oi.ticketHolders.map((th) => ({
            slot_number: th.slotNumber, full_name: th.fullName, cpf: th.cpf,
            email: th.email, birth_date: th.birthDate ? th.birthDate.toISOString().slice(0, 10) : null,
          })),
          tickets: oi.tickets.map((t) => ({
            id: t.id, slot_number: t.slotNumber, qr_token: t.qrToken, status: t.status,
          })),
        })),
      })),
    };
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
        qrToken: true,
        orderItem: { select: { ticket: { select: { name: true } } } },
        order: {
          select: {
            userId: true,
            event: { select: { title: true, dateStart: true, venueName: true, city: true, state: true } },
          },
        },
      },
    });
    if (!ticket || ticket.order.userId !== userId) throw new NotFoundException('Ingresso não encontrado');

    const profile = await this.prisma.profile.findUnique({ where: { id: userId }, select: { fullName: true, phone: true } });
    if (!profile?.phone) throw new BadRequestException('Cadastre um telefone no seu perfil pra receber o ingresso por WhatsApp.');

    await this.whatsapp.enviar({
      to: profile.phone,
      recipientName: profile.fullName ?? 'Cliente',
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
