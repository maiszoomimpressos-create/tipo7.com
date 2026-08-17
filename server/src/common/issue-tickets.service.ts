import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from './email.service';
import { WhatsAppService } from './whatsapp.service';
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
    private readonly whatsapp: WhatsAppService,
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
        caixaId: true,
        event: { select: { title: true, dateStart: true, venueName: true, city: true, state: true, bannerUrl: true } },
      },
    });

    if (!order || !generatedTickets.length) return;

    // Achado real (17/08/2026): em venda de bilheteria (presencial), `userId`
    // aqui é quem OPEROU o caixa, não quem comprou — mandar e-mail/WhatsApp
    // pro perfil dele notificava o operador, não o cliente. Nesse caso quem
    // avisa o comprador é a própria BilheteriaService, depois de confirmar o
    // pagamento, com o telefone que o operador digitou em "Dados do
    // comprador" (ver notificarCompradorPresencial() abaixo) — aqui só cria
    // os tickets e para.
    if (order.caixaId) return;

    if (!process.env.RESEND_API_KEY) return;
    if (!order.userId) return;

    const emailRows = await this.prisma.$queryRaw<{ id: string; email: string }[]>`
      SELECT * FROM get_user_emails(ARRAY[${order.userId}::uuid])
    `;
    const buyerEmail = emailRows[0]?.email;
    if (!buyerEmail) return;

    const profile = await this.prisma.profile.findUnique({ where: { id: order.userId }, select: { fullName: true, phone: true } });
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

    // WhatsApp (Boot Whats) — best-effort, nunca bloqueia a emissão do
    // ingresso se falhar. A API deles só aceita 1 QR code por mensagem
    // (ver documentação da integração), então manda uma chamada por
    // ingresso do pedido, não uma só pra tudo.
    //
    // `details` (08/08/2026): antes só mandava to/type/recipientName/qrData
    // — a Boot Whats não tinha como montar o texto da mensagem com nome do
    // evento/data/local, precisava adivinhar ou deixar genérico. Manda
    // esses campos junto agora; contrato documentado em
    // docs/boot-whats-details.md (pra combinar com o time deles antes do
    // texto do template mudar do lado de lá).
    if (profile?.phone) {
      for (const t of ticketEmailList) {
        await this.whatsapp.enviar({
          to: profile.phone,
          recipientName: buyerName,
          type: 'ingresso_emitido',
          qrData: t.qr_token,
          details: {
            nome_evento: order.event?.title ?? 'Evento',
            data: order.event?.dateStart?.toISOString() ?? '',
            ingresso: t.ticket_name,
            local: order.event?.venueName ?? '',
            cidade: order.event?.city ?? '',
            estado: order.event?.state ?? '',
          },
        });
      }
    }
  }

  // Venda presencial de bilheteria — chamado pela BilheteriaService depois
  // de confirmar o pagamento e salvar o TicketHolder, com o telefone que o
  // operador do caixa digitou em "Dados do comprador". Só WhatsApp: cliente
  // de balcão não passa e-mail, então não tem pra onde mandar o e-mail do
  // ingresso (diferente da compra online, onde `issueTickets()` acima já
  // resolve o e-mail/telefone certos porque ali `order.userId` É o
  // comprador). Best-effort, igual ao WhatsApp de issueTickets().
  async notificarCompradorPresencial(orderId: string, contato: { nome: string; telefone: string }): Promise<void> {
    if (!contato.telefone) return;

    const tickets = await this.prisma.ticket.findMany({
      where: { orderId },
      select: { qrToken: true, orderItem: { select: { ticket: { select: { name: true } } } } },
    });
    if (!tickets.length) return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { event: { select: { title: true, dateStart: true, venueName: true, city: true, state: true } } },
    });

    for (const t of tickets) {
      try {
        await this.whatsapp.enviar({
          to: contato.telefone,
          recipientName: contato.nome || 'Cliente',
          type: 'ingresso_emitido',
          qrData: t.qrToken,
          details: {
            nome_evento: order?.event?.title ?? 'Evento',
            data: order?.event?.dateStart?.toISOString() ?? '',
            ingresso: t.orderItem?.ticket?.name ?? 'Ingresso',
            local: order?.event?.venueName ?? '',
            cidade: order?.event?.city ?? '',
            estado: order?.event?.state ?? '',
          },
        });
      } catch (err) {
        this.logger.error('[notificarCompradorPresencial] falha ao enviar whatsapp', err as Error);
      }
    }
  }
}
