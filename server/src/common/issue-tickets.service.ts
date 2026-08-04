import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from './email.service';
import { gerarQrToken } from './qr-token.util';
import { PrismaService } from '../prisma/prisma.service';

// Porte 1:1 de web/src/lib/issueTickets.ts. Idempotente: reenviar com o
// mesmo orderId não cria duplicatas (unique em order_item_id+slot_number).
@Injectable()
export class IssueTicketsService {
  private readonly logger = new Logger(IssueTicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async issueTickets(orderId: string): Promise<void> {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      select: { id: true, quantity: true, ticket: { select: { name: true } } },
    });
    if (!items.length) return;

    const ticketRows = items.flatMap((item) =>
      Array.from({ length: item.quantity }, (_, i) => ({
        orderId,
        orderItemId: item.id,
        slotNumber: i + 1,
        qrToken: gerarQrToken(),
      })),
    );
    await this.prisma.ticket.createMany({ data: ticketRows, skipDuplicates: true });

    const generatedTickets = await this.prisma.ticket.findMany({
      where: { orderId },
      select: { orderItemId: true, slotNumber: true, qrToken: true },
    });

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        userId: true,
        event: { select: { title: true, dateStart: true, venueName: true, city: true, state: true, bannerUrl: true } },
      },
    });

    if (!order || !generatedTickets.length || !process.env.RESEND_API_KEY) return;
    if (!order.userId) return;

    const emailRows = await this.prisma.$queryRaw<{ id: string; email: string }[]>`
      SELECT * FROM get_user_emails(ARRAY[${order.userId}::uuid])
    `;
    const buyerEmail = emailRows[0]?.email;
    if (!buyerEmail) return;

    const profile = await this.prisma.profile.findUnique({ where: { id: order.userId }, select: { fullName: true } });
    const buyerName = profile?.fullName ?? 'Cliente';

    const ticketEmailList = generatedTickets.map((t) => {
      const item = items.find((i) => i.id === t.orderItemId);
      return {
        ticket_name: item?.ticket?.name ?? 'Ingresso',
        slot_number: t.slotNumber,
        qr_token: t.qrToken,
      };
    });

    try {
      await this.email.sendTicketEmail({
        to: buyerEmail,
        buyerName,
        event: order.event
          ? {
              title: order.event.title ?? 'Evento',
              date_start: order.event.dateStart?.toISOString() ?? null,
              venue_name: order.event.venueName,
              city: order.event.city,
              state: order.event.state,
              banner_url: order.event.bannerUrl,
            }
          : { title: 'Evento', date_start: null, venue_name: null, city: null, state: null, banner_url: null },
        tickets: ticketEmailList,
      });
    } catch (err) {
      this.logger.error('[issueTickets] falha ao enviar email', err as Error);
    }
  }
}
