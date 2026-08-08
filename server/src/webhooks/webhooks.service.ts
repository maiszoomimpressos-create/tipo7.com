import { Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { IssueTicketsService } from '../common/issue-tickets.service';
import { MpTokenService } from '../common/mp-token.service';
import { PlatformCredentialsService } from '../common/platform-credentials.service';
import { SaldoBilheteriaService } from '../common/saldo-bilheteria.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

// Mapeia o nome do campo no payload da Autosave (snake_case, contrato
// externo) pro nome do campo no Prisma (camelCase). Regra de reconciliação:
// só completa campos vazios no profile local — nunca sobrescreve o que o
// usuário já preencheu diretamente aqui.
const CAMPOS_SINCRONIZAVEIS_AUTOSAVE: Array<{ payloadKey: string; prismaKey: string }> = [
  { payloadKey: 'full_name', prismaKey: 'fullName' },
  { payloadKey: 'cpf', prismaKey: 'cpf' },
  { payloadKey: 'phone', prismaKey: 'phone' },
  { payloadKey: 'rg', prismaKey: 'rg' },
  { payloadKey: 'birth_date', prismaKey: 'birthDate' },
  { payloadKey: 'zip_code', prismaKey: 'zipCode' },
  { payloadKey: 'street', prismaKey: 'street' },
  { payloadKey: 'street_number', prismaKey: 'streetNumber' },
  { payloadKey: 'neighborhood', prismaKey: 'neighborhood' },
  { payloadKey: 'city', prismaKey: 'city' },
  { payloadKey: 'state', prismaKey: 'state' },
  { payloadKey: 'complement', prismaKey: 'complement' },
];

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
    if (!ts || !v1) {
      this.logger.warn(`[webhook] x-signature sem ts/v1 — header cru: "${xSignature}"`);
      return false;
    }

    const age = Math.abs(Date.now() - parseInt(ts, 10) * 1000);
    if (age > 5 * 60 * 1000) {
      this.logger.warn(`[webhook] ts fora da janela de 5min — ts=${ts} idade=${age}ms`);
      return false;
    }

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');
    if (expected !== v1) {
      // Diagnóstico temporário (07/08/2026) — remover depois de confirmar a
      // causa do mismatch de assinatura em produção. Não loga o segredo em
      // si, só o suficiente pra comparar o hash esperado vs recebido.
      this.logger.warn(
        `[webhook] hash nao bate — manifest="${manifest}" secretLen=${secret.length} esperado=${expected} recebido=${v1}`,
      );
    }
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

  private assinaturaValidaAutosave(rawBody: string, assinatura: string | null, segredo: string): boolean {
    if (!assinatura) return false;
    const esperada = createHmac('sha256', segredo).update(rawBody).digest('hex');
    if (esperada.length !== assinatura.length) return false;
    return timingSafeEqual(Buffer.from(esperada), Buffer.from(assinatura));
  }

  // Webhook recebido da Autosave — notifica quando um customer é criado ou
  // atualizado (inclusive por outro sistema do mesmo grupo, não só o
  // Tipo7), pra manter o profile local enriquecido sem precisar de
  // polling.
  async autosave(rawBody: Buffer | undefined, assinatura: string | null) {
    const integracao = await this.prisma.apiIntegracao.findUnique({
      where: { areaSlug: 'usuarios' },
      select: { webhookSecret: true },
    });
    const segredo = integracao?.webhookSecret;
    if (!segredo) throw new InternalServerErrorException('Webhook não configurado');

    const rawText = rawBody?.toString('utf-8') ?? '';
    if (!this.assinaturaValidaAutosave(rawText, assinatura, segredo)) {
      throw new UnauthorizedException('Assinatura inválida');
    }

    const payload = JSON.parse(rawText) as {
      event?: 'created' | 'updated';
      resource?: string;
      data?: Record<string, unknown>;
    };

    if (payload.resource !== 'customers' || !payload.data) return { ok: true };

    const externalId = payload.data.external_id;
    if (typeof externalId !== 'string') return { ok: true };

    const perfilAtual = await this.prisma.profile.findUnique({
      where: { id: externalId },
      select: {
        fullName: true, cpf: true, phone: true, rg: true, birthDate: true,
        zipCode: true, street: true, streetNumber: true, neighborhood: true,
        city: true, state: true, complement: true,
      },
    });
    if (!perfilAtual) return { ok: true };

    const atualizacoes: Record<string, unknown> = {};
    for (const { payloadKey, prismaKey } of CAMPOS_SINCRONIZAVEIS_AUTOSAVE) {
      const valorAtual = (perfilAtual as Record<string, unknown>)[prismaKey];
      const valorNovo = payload.data[payloadKey];
      if ((valorAtual === null || valorAtual === '') && valorNovo) {
        atualizacoes[prismaKey] = prismaKey === 'birthDate' ? new Date(String(valorNovo)) : valorNovo;
      }
    }

    if (Object.keys(atualizacoes).length > 0) {
      await this.prisma.profile.update({ where: { id: externalId }, data: atualizacoes });
    }

    return { ok: true };
  }
}
