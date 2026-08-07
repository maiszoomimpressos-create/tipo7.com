import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Porte de web/src/app/meus-ingressos/page.tsx (Fase 7.2, G10) — resposta em
// snake_case pra bater 1:1 com o tipo Order já definido em MeusIngressosClient.tsx.
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

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
            tickets: { select: { slotNumber: true, qrToken: true, status: true } },
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
          ticket_holders: oi.ticketHolders.map((th) => ({
            slot_number: th.slotNumber, full_name: th.fullName, cpf: th.cpf,
            email: th.email, birth_date: th.birthDate,
          })),
          tickets: oi.tickets.map((t) => ({
            slot_number: t.slotNumber, qr_token: t.qrToken, status: t.status,
          })),
        })),
      })),
    };
  }
}
