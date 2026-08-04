import { Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { IssueTicketsService } from '../common/issue-tickets.service';
import { MpTokenService } from '../common/mp-token.service';
import { PlatformCredentialsService } from '../common/platform-credentials.service';
import { SaldoBilheteriaService } from '../common/saldo-bilheteria.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

const MP_STATUS_MAP: Record<string, string> = {
  approved: 'approved',
  pending: 'in_process',
  in_process: 'in_process',
  rejected: 'rejected',
  cancelled: 'cancelled',
};

// PagBank escreve "CANCELED" (um L, inglês americano) — conferido na doc
// oficial de webhooks. Mantém CANCELLED (dois L) também por segurança.
const PAGBANK_STATUS_MAP: Record<string, string> = {
  PAID: 'approved',
  AUTHORIZED: 'approved',
  IN_ANALYSIS: 'in_process',
  WAITING: 'pending',
  DECLINED: 'rejected',
  CANCELED: 'cancelled',
  CANCELLED: 'cancelled',
};

interface PagBankWebhookBody {
  reference_id?: string;
  charges?: Array<{ id: string; reference_id?: string; status: string }>;
  order?: { reference_id?: string };
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

// Porte 1:1 de web/src/app/api/webhooks/{mercadopago,pagbank}/route.ts.
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformCredentials: PlatformCredentialsService,
    private readonly mpToken: MpTokenService,
    private readonly issueTicketsService: IssueTicketsService,
    private readonly saldoBilheteria: SaldoBilheteriaService,
  ) {}

  private async verificarAssinaturaMp(headers: Record<string, string | string[] | undefined>, dataId: string): Promise<boolean> {
    const { webhookSecret: secret } = await this.platformCredentials.getMpCredentials();
    if (!secret) {
      this.logger.warn('[webhook] MP_WEBHOOK_SECRET não configurado — verificação de assinatura ignorada');
      return true;
    }

    const xSignature = String(headers['x-signature'] ?? '');
    const xRequestId = String(headers['x-request-id'] ?? '');

    const ts = xSignature.match(/ts=([^,]+)/)?.[1] ?? '';
    const v1 = xSignature.match(/v1=([^,]+)/)?.[1] ?? '';
    if (!ts || !v1) return false;

    const age = Math.abs(Date.now() - parseInt(ts, 10) * 1000);
    if (age > 5 * 60 * 1000) return false;

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');
    return expected === v1;
  }

  async mercadopago(headers: Record<string, string | string[] | undefined>, body: { type?: string; data?: { id?: string | number } }) {
    if (body?.type !== 'payment') return { ok: true };

    const paymentId = body.data?.id;
    if (!paymentId) return { ok: true };

    if (!(await this.verificarAssinaturaMp(headers, String(paymentId)))) {
      this.logger.warn('[webhook] assinatura inválida — requisição rejeitada');
      throw new UnauthorizedException('Assinatura inválida');
    }

    // Pagamentos de bilheteria são criados com o token OAuth do dono do
    // evento, não com o token da plataforma — usar token errado retorna 403.
    let mpAccessToken = (await this.platformCredentials.getMpCredentials()).accessToken;

    const orderRow = await this.prisma.order.findFirst({ where: { mpPaymentId: String(paymentId) }, select: { eventId: true } });
    if (orderRow?.eventId) {
      const evento = await this.prisma.event.findUnique({ where: { id: orderRow.eventId }, select: { organizationId: true } });
      if (evento?.organizationId) {
        const org = await this.prisma.organization.findUnique({ where: { id: evento.organizationId }, select: { ownerId: true } });
        if (org?.ownerId) {
          const promoterToken = await this.mpToken.getMpToken(org.ownerId);
          if (promoterToken) mpAccessToken = promoterToken;
        }
      }
    }

    const mpClient = new MercadoPagoConfig({ accessToken: mpAccessToken });
    const payment = new Payment(mpClient);

    let paymentData: Awaited<ReturnType<typeof payment.get>>;
    try {
      paymentData = await payment.get({ id: String(paymentId) });
    } catch (err) {
      this.logger.error(`[webhook] erro ao buscar pagamento no MP: ${JSON.stringify(err)}`);
      throw new InternalServerErrorException('Erro ao buscar pagamento');
    }

    const orderId = paymentData.external_reference;
    if (!orderId) return { ok: true };

    const newStatus = MP_STATUS_MAP[paymentData.status ?? ''] ?? 'pending';

    // Idempotência: chave composta (payment_id + status) — MP envia 2
    // webhooks para PIX (pending na criação, approved no pagamento).
    try {
      await this.prisma.processedWebhook.create({ data: { paymentId: String(paymentId), orderId, mpStatus: newStatus } });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        this.logger.log(`[webhook] payment ${paymentId} status=${newStatus} já processado, ignorando`);
        return { ok: true };
      }
      this.logger.error('[webhook] erro na tabela processed_webhooks (continuando)', err as Error);
    }

    await this.prisma.order.update({ where: { id: orderId }, data: { status: newStatus, mpPaymentId: String(paymentId) } });

    if (newStatus === 'approved') {
      await this.issueTicketsService.issueTickets(orderId);
      await this.saldoBilheteria.processarSaldoAposAprovacao(orderId);
    }

    return { ok: true };
  }

  // SEM verificação de assinatura: o PagBank não expõe nenhum campo pra
  // configurar um segredo compartilhado de notificação (diferente do MP).
  // Mitigação é só o orderId ser um UUID não adivinhável — ver nota no
  // arquivo original antes de este checkout ir pra produção de verdade.
  async pagbank(body: PagBankWebhookBody) {
    const charge = body?.charges?.[0];
    const pbStatus = charge?.status;
    const orderId = body?.reference_id ?? charge?.reference_id ?? body?.order?.reference_id;

    if (!orderId || !pbStatus) return { ok: true };

    const chargeId = charge?.id ?? orderId;
    const newStatus = PAGBANK_STATUS_MAP[pbStatus] ?? 'pending';

    try {
      await this.prisma.processedWebhook.create({
        data: { paymentId: chargeId, orderId, gateway: 'pagbank', mpStatus: newStatus },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        this.logger.log(`[webhook/pagbank] charge ${chargeId} status=${newStatus} já processado, ignorando`);
        return { ok: true };
      }
      this.logger.error('[webhook/pagbank] erro em processed_webhooks (continuando)', err as Error);
    }

    await this.prisma.order.update({ where: { id: orderId }, data: { status: newStatus, pagbankChargeId: chargeId } });

    if (newStatus === 'approved') await this.issueTicketsService.issueTickets(orderId);

    return { ok: true };
  }
}
