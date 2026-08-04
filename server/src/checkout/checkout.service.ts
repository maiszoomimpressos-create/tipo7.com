import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { FeeRulesService } from '../common/fee-rules.service';
import { GatewayResolverService } from '../common/gateway-resolver.service';
import { IssueTicketsService } from '../common/issue-tickets.service';
import { MpTokenService } from '../common/mp-token.service';
import { PagBankClientService, PagBankError } from '../common/pagbank-client.service';
import { buildPagBankPixOrder } from '../common/pagbank-pix.util';
import { PagBankTokenService } from '../common/pagbank-token.service';
import { PedidoAtomicoService } from '../common/pedido-atomico.service';
import { PlatformCredentialsService } from '../common/platform-credentials.service';
import { RateLimitDbService } from '../common/rate-limit-db.service';
import { SaldoBilheteriaService } from '../common/saldo-bilheteria.service';
import { PrismaService } from '../prisma/prisma.service';

interface ItemInput {
  ticketId: string;
  quantity: number;
}

type MpPayerCost = {
  installments: number;
  installment_rate: number;
  installment_amount: number;
  total_amount: number;
};

type MpInstallmentsResponse = Array<{
  payment_method_id: string;
  issuer?: { id: number };
  payer_costs: MpPayerCost[];
}>;

interface PagBankOrderResponse {
  id: string;
  charges?: Array<{ id: string; status: string }>;
  qr_codes?: Array<{
    id: string;
    text: string;
    expiration_date: string;
    amount: { value: number };
    links?: Array<{ rel: string; href: string; media: string; type: string }>;
  }>;
}

// Mapeamento de status PagBank → status interno do sistema (cartão).
const PAGBANK_STATUS_MAP: Record<string, string> = {
  PAID: 'approved',
  AUTHORIZED: 'approved',
  IN_ANALYSIS: 'in_process',
  DECLINED: 'rejected',
  CANCELED: 'cancelled',
  CANCELLED: 'cancelled',
};

// Porte 1:1 das rotas web/src/app/api/checkout/** (Mercado Pago + PagBank).
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly isLocal = process.env.NODE_ENV === 'development';

  constructor(
    private readonly prisma: PrismaService,
    private readonly feeRules: FeeRulesService,
    private readonly saldoBilheteria: SaldoBilheteriaService,
    private readonly mpToken: MpTokenService,
    private readonly pagbankToken: PagBankTokenService,
    private readonly pagbankClient: PagBankClientService,
    private readonly platformCredentials: PlatformCredentialsService,
    private readonly pedidoAtomico: PedidoAtomicoService,
    private readonly gatewayResolver: GatewayResolverService,
    private readonly rateLimitDb: RateLimitDbService,
    private readonly issueTicketsService: IssueTicketsService,
  ) {}

  private validarItems(items: ItemInput[] | undefined): asserts items is ItemInput[] {
    if (!items?.length) throw new BadRequestException('Nenhum ingresso selecionado');
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100) {
        throw new BadRequestException('Quantidade inválida');
      }
    }
  }

  // POST /checkout — MP Preference (redirect).
  async criarPreference(
    userId: string,
    userEmail: string | undefined,
    fullName: string | undefined,
    ip: string,
    body: { eventoId?: string; items?: ItemInput[] },
  ) {
    await this.rateLimitDb.enforce(ip, 'checkout', this.isLocal ? 100 : 10, 60_000);

    const { eventoId, items } = body;
    this.validarItems(items);
    if (!eventoId) throw new BadRequestException('eventoId obrigatório');

    const eventoFlag = await this.prisma.event.findUnique({ where: { id: eventoId }, select: { vendasOnlinePausadas: true } });
    if (eventoFlag?.vendasOnlinePausadas) {
      throw new ServiceUnavailableException('Vendas temporariamente pausadas. Tente novamente em instantes.');
    }

    const tickets = await this.prisma.eventTicket.findMany({
      where: { id: { in: items.map((i) => i.ticketId) }, eventId: eventoId },
      select: { id: true, name: true, price: true, quantity: true },
    });
    if (!tickets.length) throw new BadRequestException('Ingressos não encontrados');

    const lineItems = items.map((item) => {
      const ticket = tickets.find((t) => t.id === item.ticketId);
      if (!ticket) throw new BadRequestException(`Ingresso ${item.ticketId} não encontrado`);
      return { ticket, quantity: item.quantity };
    });

    const total = lineItems.reduce((sum, { ticket, quantity }) => sum + Number(ticket.price ?? 0) * quantity, 0);

    const resultado = await this.pedidoAtomico.criar(
      userId,
      eventoId,
      lineItems.map(({ ticket, quantity }) => ({ ticket_id: ticket.id, quantity, unit_price: Number(ticket.price ?? 0) })),
    );
    if (resultado.error === 'sem_estoque') {
      const ticketName = tickets.find((t) => t.id === resultado.ticket_id)?.name ?? 'Ingresso';
      throw new ConflictException(`Quantidade indisponível para "${ticketName}". Restam ${resultado.disponivel ?? 0}.`);
    }
    if (resultado.error || !resultado.order_id) throw new InternalServerErrorException('Erro ao criar pedido');
    const orderId = resultado.order_id;

    const config = await this.feeRules.buscarConfigTaxaIngressosOnline();

    const evento = await this.prisma.event.findUnique({ where: { id: eventoId }, select: { organization: { select: { ownerId: true } } } });
    const ownerId = evento?.organization?.ownerId ?? undefined;

    let mpTokenAtivo = (await this.platformCredentials.getMpCredentials()).accessToken;
    let marketplaceFee: number | undefined;

    if (ownerId) {
      const tokenPromotor = await this.mpToken.getMpToken(ownerId);
      if (tokenPromotor) {
        mpTokenAtivo = tokenPromotor;
        marketplaceFee = await this.feeRules.calcularTaxaPlataforma({
          eventoId,
          ownerId,
          total,
          ticketCount: lineItems.reduce((s, i) => s + i.quantity, 0),
          config,
        });

        const saldo = await this.saldoBilheteria.buscarSaldoBilheteria(eventoId);
        if (saldo?.ativo) {
          marketplaceFee += this.saldoBilheteria.calcularContribuicaoSaldo(total, marketplaceFee, saldo.retencao_pct);
        }
      }
    }

    const MP_BASE_URL = 'https://www.tipo7.com';
    const [firstName, ...restName] = (fullName ?? '').trim().split(' ');

    try {
      const client = new MercadoPagoConfig({ accessToken: mpTokenAtivo });
      const preference = new Preference(client);

      const result = await preference.create({
        body: {
          items: lineItems.map(({ ticket, quantity }) => ({
            id: ticket.id,
            title: ticket.name ?? 'Ingresso',
            quantity,
            unit_price: Number(ticket.price ?? 0),
            currency_id: 'BRL',
          })),
          payer: {
            email: userEmail ?? '',
            name: firstName ?? '',
            surname: restName.join(' ') ?? '',
          },
          back_urls: {
            success: `${MP_BASE_URL}/checkout/sucesso`,
            failure: `${MP_BASE_URL}/checkout/falha`,
            pending: `${MP_BASE_URL}/checkout/pendente`,
          },
          auto_return: 'approved',
          notification_url: `${MP_BASE_URL}/api/webhooks/mercadopago`,
          external_reference: orderId,
          marketplace_fee: marketplaceFee,
        },
      });

      await this.prisma.order.update({ where: { id: orderId }, data: { mpPreferenceId: result.id } });

      return { checkoutUrl: result.init_point };
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Erro interno';
      this.logger.error(`[checkout] ${msg}`);
      throw new InternalServerErrorException(msg);
    }
  }

  // POST /checkout/pix — MP Payments API PIX (Checkout Transparente).
  async criarPix(
    userId: string,
    userEmail: string | undefined,
    fullName: string | undefined,
    ip: string,
    body: { eventoId?: string; items?: ItemInput[] },
  ) {
    await this.rateLimitDb.enforce(ip, 'checkout-pix', this.isLocal ? 100 : 10, 60_000);

    const { eventoId, items } = body;
    if (!eventoId) throw new BadRequestException('eventoId obrigatório');
    this.validarItems(items);

    const eventoFlag = await this.prisma.event.findUnique({
      where: { id: eventoId },
      select: { vendasOnlinePausadas: true, paymentGateway: true },
    });
    if (eventoFlag?.vendasOnlinePausadas) {
      throw new ServiceUnavailableException('Vendas temporariamente pausadas. Tente novamente em instantes.');
    }
    if (eventoFlag?.paymentGateway === 'pagbank') {
      throw new BadRequestException('Use /api/checkout/pagbank-pix para este evento');
    }

    const { ownerId: donoEvento } = await this.gatewayResolver.resolveEventGateway(eventoId);
    const mpTokenPromotor = donoEvento ? await this.mpToken.getMpToken(donoEvento) : null;
    if (!mpTokenPromotor) {
      throw new ServiceUnavailableException('O promotor deste evento ainda não conectou uma conta Mercado Pago. Pagamento indisponível.');
    }

    const [tickets, evento] = await Promise.all([
      this.prisma.eventTicket.findMany({
        where: { id: { in: items.map((i) => i.ticketId) }, eventId: eventoId },
        select: { id: true, name: true, price: true, quantity: true },
      }),
      this.prisma.event.findUnique({ where: { id: eventoId }, select: { title: true } }),
    ]);
    if (!tickets.length) throw new BadRequestException('Ingressos não encontrados');

    const lineItems = items.map((item) => {
      const ticket = tickets.find((t) => t.id === item.ticketId);
      if (!ticket) throw new BadRequestException(`Ingresso ${item.ticketId} não encontrado`);
      return { ticket, quantity: item.quantity };
    });

    const faceValue = lineItems.reduce((sum, { ticket, quantity }) => sum + Number(ticket.price ?? 0) * quantity, 0);
    if (faceValue <= 0) throw new BadRequestException('PIX não disponível para ingressos gratuitos');

    const profile = await this.prisma.profile.findUnique({ where: { id: userId }, select: { cpf: true, fullName: true } });
    const cpf = profile?.cpf?.replace(/\D/g, '');
    if (!cpf || cpf.length !== 11) throw new UnprocessableEntityException('Cadastre seu CPF no perfil antes de pagar com PIX.');

    const resultado = await this.pedidoAtomico.criar(
      userId,
      eventoId,
      lineItems.map(({ ticket, quantity }) => ({ ticket_id: ticket.id, quantity, unit_price: Number(ticket.price ?? 0) })),
    );
    if (resultado.error === 'sem_estoque') {
      const ticketName = tickets.find((t) => t.id === resultado.ticket_id)?.name ?? 'Ingresso';
      throw new ConflictException(`Quantidade indisponível para "${ticketName}". Restam ${resultado.disponivel ?? 0}.`);
    }
    if (resultado.error || !resultado.order_id) throw new InternalServerErrorException('Erro ao criar pedido');
    const orderId = resultado.order_id;

    const config = await this.feeRules.buscarConfigTaxaIngressosOnline();
    const transactionAmount = faceValue;

    let applicationFee = await this.feeRules.calcularTaxaPlataforma({
      eventoId,
      ownerId: donoEvento!,
      total: faceValue,
      ticketCount: lineItems.reduce((s, i) => s + i.quantity, 0),
      config,
    });

    const saldo = await this.saldoBilheteria.buscarSaldoBilheteria(eventoId);
    if (saldo?.ativo) applicationFee += this.saldoBilheteria.calcularContribuicaoSaldo(faceValue, applicationFee, saldo.retencao_pct);

    const nameSource = profile?.fullName ?? fullName ?? '';
    const nameParts = nameSource.trim().split(' ');
    const firstName = nameParts[0] ?? '';
    const lastName = nameParts.slice(1).join(' ') || firstName;

    try {
      const mpClient = new MercadoPagoConfig({ accessToken: mpTokenPromotor });
      const payment = new Payment(mpClient);

      const result = await payment.create({
        body: {
          transaction_amount: transactionAmount,
          description: `Ingressos - ${evento?.title ?? 'Evento'}`.slice(0, 255),
          payment_method_id: 'pix',
          payer: {
            email: userEmail ?? '',
            first_name: firstName,
            last_name: lastName,
            identification: { type: 'CPF', number: cpf },
          },
          notification_url: 'https://www.tipo7.com/api/webhooks/mercadopago',
          external_reference: orderId,
          application_fee: applicationFee,
        },
        requestOptions: { idempotencyKey: orderId },
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
        },
      });

      return { orderId, qrCode, qrCodeBase64, expiresAt, total: transactionAmount };
    } catch (err) {
      this.logger.error(`[checkout/pix] ${JSON.stringify(err)}`);
      throw new InternalServerErrorException('Falha ao processar pagamento. Tente novamente.');
    }
  }

  // POST /checkout/card — MP Payments API cartão (Checkout Transparente).
  async criarCard(
    userId: string,
    userEmail: string | undefined,
    ip: string,
    body: {
      eventoId?: string;
      items?: ItemInput[];
      cardToken?: string;
      installments?: number;
      issuerId?: string;
      paymentMethodId?: string;
      bin?: string;
    },
  ) {
    await this.rateLimitDb.enforce(ip, 'checkout-card', this.isLocal ? 100 : 5, 60_000);

    const { eventoId, items, cardToken, installments, issuerId, paymentMethodId, bin } = body;
    if (!cardToken || !eventoId || !items?.length || !paymentMethodId) throw new BadRequestException('Dados incompletos');
    if (!installments || !Number.isInteger(installments) || installments < 1 || installments > 12) {
      throw new BadRequestException('Número de parcelas inválido');
    }
    this.validarItems(items);

    const eventoGateway = await this.prisma.event.findUnique({ where: { id: eventoId }, select: { paymentGateway: true } });
    if (eventoGateway?.paymentGateway === 'pagbank') {
      throw new BadRequestException('Use /api/checkout/pagbank-card para este evento');
    }

    const { ownerId: donoEvento } = await this.gatewayResolver.resolveEventGateway(eventoId);
    const mpTokenPromotor = donoEvento ? await this.mpToken.getMpToken(donoEvento) : null;
    if (!mpTokenPromotor) {
      throw new ServiceUnavailableException('O promotor deste evento ainda não conectou uma conta Mercado Pago. Pagamento indisponível.');
    }

    const [tickets, evento] = await Promise.all([
      this.prisma.eventTicket.findMany({
        where: { id: { in: items.map((i) => i.ticketId) }, eventId: eventoId },
        select: { id: true, name: true, price: true, quantity: true },
      }),
      this.prisma.event.findUnique({ where: { id: eventoId }, select: { title: true } }),
    ]);
    if (!tickets.length) throw new BadRequestException('Ingressos não encontrados');

    const lineItems = items.map((item) => {
      const ticket = tickets.find((t) => t.id === item.ticketId);
      if (!ticket) throw new BadRequestException(`Ingresso ${item.ticketId} não encontrado`);
      return { ticket, quantity: item.quantity };
    });

    const faceValue = lineItems.reduce((sum, { ticket, quantity }) => sum + Number(ticket.price ?? 0) * quantity, 0);
    if (faceValue <= 0) throw new BadRequestException('Valor inválido para pagamento com cartão');

    const resultado = await this.pedidoAtomico.criar(
      userId,
      eventoId,
      lineItems.map(({ ticket, quantity }) => ({ ticket_id: ticket.id, quantity, unit_price: Number(ticket.price ?? 0) })),
    );
    if (resultado.error === 'sem_estoque') {
      const ticketName = tickets.find((t) => t.id === resultado.ticket_id)?.name ?? 'Ingresso';
      throw new ConflictException(`Quantidade indisponível para "${ticketName}". Restam ${resultado.disponivel ?? 0}.`);
    }
    if (resultado.error || !resultado.order_id) throw new InternalServerErrorException('Erro ao criar pedido');
    const orderId = resultado.order_id;

    const config = await this.feeRules.buscarConfigTaxaIngressosOnline();

    let transactionAmount = faceValue;
    try {
      const url = new URL('https://api.mercadopago.com/v1/payment_methods/installments');
      url.searchParams.set('payment_method_id', paymentMethodId);
      url.searchParams.set('amount', String(faceValue));
      if (issuerId) url.searchParams.set('issuer.id', issuerId);
      if (bin) url.searchParams.set('bin', bin.slice(0, 6));

      const mpRes = await fetch(url.toString(), { headers: { Authorization: `Bearer ${mpTokenPromotor}` } });
      if (mpRes.ok) {
        const data = (await mpRes.json()) as MpInstallmentsResponse;
        const chosen = data[0]?.payer_costs?.find((c) => c.installments === installments);
        if (chosen?.total_amount) transactionAmount = chosen.total_amount;
      }
    } catch {
      // Fallback: usa faceValue (equivale a 1× sem juros)
    }

    let applicationFee = await this.feeRules.calcularTaxaPlataforma({
      eventoId,
      ownerId: donoEvento!,
      total: faceValue,
      ticketCount: lineItems.reduce((s, i) => s + i.quantity, 0),
      config,
    });

    const saldo = await this.saldoBilheteria.buscarSaldoBilheteria(eventoId);
    if (saldo?.ativo) applicationFee += this.saldoBilheteria.calcularContribuicaoSaldo(faceValue, applicationFee, saldo.retencao_pct);

    try {
      const mpClient = new MercadoPagoConfig({ accessToken: mpTokenPromotor });
      const payment = new Payment(mpClient);

      const result = await payment.create({
        body: {
          transaction_amount: transactionAmount,
          token: cardToken,
          description: `Ingressos - ${evento?.title ?? 'Evento'}`.slice(0, 255),
          installments,
          payment_method_id: paymentMethodId,
          issuer_id: issuerId ? Number(issuerId) : undefined,
          payer: { email: userEmail ?? '' },
          notification_url: 'https://www.tipo7.com/api/webhooks/mercadopago',
          external_reference: orderId,
          application_fee: applicationFee,
        },
        requestOptions: { idempotencyKey: orderId },
      });

      const paymentStatus = result.status ?? 'rejected';
      const mpPaymentId = String(result.id);
      const orderStatus =
        paymentStatus === 'approved' ? 'approved' : paymentStatus === 'in_process' ? 'in_process' : paymentStatus === 'pending' ? 'pending' : 'rejected';

      await this.prisma.order.update({ where: { id: orderId }, data: { status: orderStatus, mpPaymentId } });

      return { orderId, status: paymentStatus, paymentId: mpPaymentId };
    } catch (err) {
      this.logger.error(`[checkout/card] ${JSON.stringify(err)}`);
      const mpErr = err as { cause?: Array<{ code?: string; description?: string }> };
      if (mpErr?.cause?.length) {
        const desc = mpErr.cause[0]?.description ?? 'Pagamento recusado pelo emissor.';
        throw new UnprocessableEntityException(desc);
      }
      throw new InternalServerErrorException('Falha ao processar pagamento. Tente novamente.');
    }
  }

  // GET /checkout/gateway?eventoId=X
  async getGateway(eventoId: string) {
    const { gateway } = await this.gatewayResolver.resolveEventGateway(eventoId);
    return { gateway };
  }

  // GET /checkout/mp-config?eventoId=X
  async getMpConfig(eventoId: string) {
    const { ownerId } = await this.gatewayResolver.resolveEventGateway(eventoId);
    let publicKey = (await this.platformCredentials.getMpCredentials()).publicKey;

    if (ownerId) {
      const mpAccount = await this.prisma.promotorMpAccount.findUnique({ where: { userId: ownerId }, select: { mpPublicKey: true } });
      if (mpAccount?.mpPublicKey) publicKey = mpAccount.mpPublicKey;
    }

    return { publicKey };
  }

  // GET /checkout/pix/status/:orderId
  async statusPix(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, status: true, total: true, pixQrCode: true, pixQrCodeBase64: true, pixExpiresAt: true, mpPaymentId: true },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');

    return {
      status: order.status,
      total: order.total,
      qrCode: order.pixQrCode,
      qrCodeBase64: order.pixQrCodeBase64,
      expiresAt: order.pixExpiresAt,
      mpPaymentId: order.mpPaymentId,
    };
  }

  // POST /checkout/pagbank-pix
  async criarPagbankPix(userId: string, userEmail: string | undefined, ip: string, body: { eventoId?: string; items?: ItemInput[] }) {
    await this.rateLimitDb.enforce(ip, 'checkout-pagbank-pix', this.isLocal ? 100 : 10, 60_000);

    const { eventoId, items } = body;
    if (!eventoId) throw new BadRequestException('eventoId obrigatório');
    this.validarItems(items);

    const profile = await this.prisma.profile.findUnique({ where: { id: userId }, select: { cpf: true, fullName: true } });
    const cleanCpf = profile?.cpf?.replace(/\D/g, '');
    if (!cleanCpf || cleanCpf.length !== 11) throw new UnprocessableEntityException('Cadastre seu CPF no perfil antes de pagar com PIX.');
    const buyerName = profile?.fullName || 'Comprador';

    const eventoFlag = await this.prisma.event.findUnique({ where: { id: eventoId }, select: { vendasOnlinePausadas: true } });
    if (eventoFlag?.vendasOnlinePausadas) {
      throw new ServiceUnavailableException('Vendas temporariamente pausadas. Tente novamente em instantes.');
    }

    const [tickets, evento] = await Promise.all([
      this.prisma.eventTicket.findMany({
        where: { id: { in: items.map((i) => i.ticketId) }, eventId: eventoId },
        select: { id: true, name: true, price: true, quantity: true },
      }),
      this.prisma.event.findUnique({ where: { id: eventoId }, select: { title: true } }),
    ]);
    if (!tickets.length) throw new BadRequestException('Ingressos não encontrados');

    const lineItems = items.map((item) => {
      const ticket = tickets.find((t) => t.id === item.ticketId);
      if (!ticket) throw new BadRequestException(`Ingresso ${item.ticketId} não encontrado`);
      return { ticket, quantity: item.quantity };
    });

    const faceValue = lineItems.reduce((sum, { ticket, quantity }) => sum + Number(ticket.price ?? 0) * quantity, 0);
    if (faceValue <= 0) throw new BadRequestException('PIX não disponível para ingressos gratuitos');

    const { ownerId } = await this.gatewayResolver.resolveEventGateway(eventoId);
    const centavosTotal = Math.round(faceValue * 100);
    const splits = ownerId ? await this.pagbankToken.resolvePagBankSplit(ownerId, centavosTotal) : null;
    if (!splits) {
      throw new ServiceUnavailableException('O promotor deste evento ainda não conectou uma conta PagBank. Pagamento indisponível.');
    }

    const resultado = await this.pedidoAtomico.criar(
      userId,
      eventoId,
      lineItems.map(({ ticket, quantity }) => ({ ticket_id: ticket.id, quantity, unit_price: Number(ticket.price ?? 0) })),
    );
    if (resultado.error === 'sem_estoque') {
      const ticketName = tickets.find((t) => t.id === resultado.ticket_id)?.name ?? 'Ingresso';
      throw new ConflictException(`Quantidade indisponível para "${ticketName}". Restam ${resultado.disponivel ?? 0}.`);
    }
    if (resultado.error || !resultado.order_id) throw new InternalServerErrorException('Erro ao criar pedido');
    const orderId = resultado.order_id;

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const orderBody = buildPagBankPixOrder({
      amount: faceValue,
      description: `Ingressos - ${evento?.title ?? 'Evento'}`,
      referenceId: orderId,
      buyerName: buyerName.trim(),
      buyerCpf: cleanCpf,
      buyerEmail: userEmail ?? '',
      notificationUrl: 'https://www.tipo7.com/api/webhooks/pagbank',
      expiresAt,
      splits,
    });

    try {
      const pbResponse = await this.pagbankClient.post<PagBankOrderResponse>('/orders', orderBody, orderId);

      const qrCode = pbResponse.qr_codes?.[0]?.text ?? null;
      const qrExpiresAt = pbResponse.qr_codes?.[0]?.expiration_date ?? expiresAt;
      const qrCodeImageUrl = pbResponse.qr_codes?.[0]?.links?.find((l) => l.rel === 'QRCODE.PNG')?.href ?? null;
      const pagbankChargeId = pbResponse.charges?.[0]?.id ?? pbResponse.id;

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          gateway: 'pagbank',
          pagbankChargeId,
          pagbankPixQrCode: qrCode,
          pagbankPixExpiresAt: new Date(qrExpiresAt),
          pagbankPixQrCodeImageUrl: qrCodeImageUrl,
        },
      });

      return { orderId, qrCode, qrCodeImageUrl, expiresAt: qrExpiresAt, total: faceValue };
    } catch (err) {
      if (err instanceof PagBankError) {
        this.logger.error(`[checkout/pagbank-pix] PagBank error: ${err.status} ${JSON.stringify(err.body)}`);
        throw new HttpException('Falha ao processar pagamento. Tente novamente.', 502);
      }
      this.logger.error(`[checkout/pagbank-pix] ${JSON.stringify(err)}`);
      throw new InternalServerErrorException('Falha ao processar pagamento. Tente novamente.');
    }
  }

  // GET /checkout/pagbank-pix/status/:orderId
  async statusPagbankPix(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: {
        id: true,
        status: true,
        total: true,
        pagbankPixQrCode: true,
        pagbankPixQrCodeImageUrl: true,
        pagbankPixExpiresAt: true,
        pagbankChargeId: true,
      },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');

    return {
      status: order.status,
      total: order.total,
      qrCode: order.pagbankPixQrCode,
      qrCodeImageUrl: order.pagbankPixQrCodeImageUrl,
      expiresAt: order.pagbankPixExpiresAt,
      pagbankChargeId: order.pagbankChargeId,
    };
  }

  // POST /checkout/pagbank-card
  async criarPagbankCard(
    userId: string,
    userEmail: string | undefined,
    ip: string,
    body: {
      eventoId?: string;
      items?: ItemInput[];
      encryptedCard?: string;
      installments?: number;
      buyerName?: string;
      buyerEmail?: string;
      cpf?: string;
    },
  ) {
    await this.rateLimitDb.enforce(ip, 'checkout-pagbank-card', this.isLocal ? 100 : 5, 60_000);

    const { eventoId, items, encryptedCard, installments, buyerName, buyerEmail, cpf } = body;
    if (!encryptedCard || !eventoId || !items?.length) throw new BadRequestException('Dados incompletos');
    if (!installments || !Number.isInteger(installments) || installments < 1 || installments > 12) {
      throw new BadRequestException('Número de parcelas inválido');
    }

    const cleanCpf = cpf?.replace(/\D/g, '');
    if (!cleanCpf || cleanCpf.length !== 11) throw new UnprocessableEntityException('CPF inválido.');

    this.validarItems(items);

    const [tickets, evento] = await Promise.all([
      this.prisma.eventTicket.findMany({
        where: { id: { in: items.map((i) => i.ticketId) }, eventId: eventoId },
        select: { id: true, name: true, price: true, quantity: true },
      }),
      this.prisma.event.findUnique({ where: { id: eventoId }, select: { title: true } }),
    ]);
    if (!tickets.length) throw new BadRequestException('Ingressos não encontrados');

    const lineItems = items.map((item) => {
      const ticket = tickets.find((t) => t.id === item.ticketId);
      if (!ticket) throw new BadRequestException(`Ingresso ${item.ticketId} não encontrado`);
      return { ticket, quantity: item.quantity };
    });

    const faceValue = lineItems.reduce((sum, { ticket, quantity }) => sum + Number(ticket.price ?? 0) * quantity, 0);
    if (faceValue <= 0) throw new BadRequestException('Valor inválido para pagamento com cartão');

    const { ownerId } = await this.gatewayResolver.resolveEventGateway(eventoId);
    const centavosTotal = Math.round(faceValue * 100);
    const splits = ownerId ? await this.pagbankToken.resolvePagBankSplit(ownerId, centavosTotal) : null;
    if (!splits) {
      throw new ServiceUnavailableException('O promotor deste evento ainda não conectou uma conta PagBank. Pagamento indisponível.');
    }

    const resultado = await this.pedidoAtomico.criar(
      userId,
      eventoId,
      lineItems.map(({ ticket, quantity }) => ({ ticket_id: ticket.id, quantity, unit_price: Number(ticket.price ?? 0) })),
    );
    if (resultado.error === 'sem_estoque') {
      const ticketName = tickets.find((t) => t.id === resultado.ticket_id)?.name ?? 'Ingresso';
      throw new ConflictException(`Quantidade indisponível para "${ticketName}". Restam ${resultado.disponivel ?? 0}.`);
    }
    if (resultado.error || !resultado.order_id) throw new InternalServerErrorException('Erro ao criar pedido');
    const orderId = resultado.order_id;

    const centavos = Math.round(faceValue * 100);

    try {
      const pbResponse = await this.pagbankClient.post<PagBankOrderResponse>(
        '/orders',
        {
          reference_id: orderId,
          customer: {
            name: buyerName?.trim() || 'Comprador',
            email: buyerEmail || (userEmail ?? ''),
            tax_id: cleanCpf,
          },
          items: [{ name: `Ingressos - ${evento?.title ?? 'Evento'}`.slice(0, 255), quantity: 1, unit_amount: centavos }],
          charges: [
            {
              reference_id: orderId,
              description: `Ingressos - ${evento?.title ?? 'Evento'}`.slice(0, 100),
              amount: { value: centavos, currency: 'BRL' },
              splits,
              payment_method: {
                type: 'CREDIT_CARD',
                installments,
                capture: true,
                card: { encrypted: encryptedCard, store: false },
                holder: { name: buyerName?.trim() || 'Comprador', tax_id: cleanCpf },
              },
            },
          ],
          notification_urls: ['https://www.tipo7.com/api/webhooks/pagbank'],
        },
        orderId,
      );

      const pbStatus = pbResponse.charges?.[0]?.status ?? 'DECLINED';
      const orderStatus = PAGBANK_STATUS_MAP[pbStatus] ?? 'rejected';
      const chargeId = pbResponse.charges?.[0]?.id ?? pbResponse.id;

      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: orderStatus, gateway: 'pagbank', pagbankChargeId: chargeId },
      });

      if (orderStatus === 'approved') await this.issueTicketsService.issueTickets(orderId);

      return { orderId, status: pbStatus };
    } catch (err) {
      if (err instanceof PagBankError) {
        this.logger.error(`[checkout/pagbank-card] PagBank error: ${err.status} ${JSON.stringify(err.body)}`);
        throw new UnprocessableEntityException('Pagamento recusado. Verifique os dados do cartão.');
      }
      this.logger.error(`[checkout/pagbank-card] ${JSON.stringify(err)}`);
      throw new InternalServerErrorException('Falha ao processar pagamento. Tente novamente.');
    }
  }

  // GET /checkout/pagbank-config
  async getPagbankConfig() {
    const publicKey = await this.pagbankClient.getPublicKey();
    return { publicKey };
  }
}
