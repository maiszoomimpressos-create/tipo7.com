import { Injectable, Logger } from '@nestjs/common';
import { PlatformCredentialsService } from './platform-credentials.service';
import { PrismaService } from '../prisma/prisma.service';

const PAGBANK_ENV = process.env.PAGBANK_ENV === 'sandbox' ? 'sandbox' : 'production';
const API_BASE = PAGBANK_ENV === 'sandbox' ? 'https://sandbox.api.pagseguro.com' : 'https://api.pagseguro.com';
const RENOVAR_ANTES_DE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export interface PagBankTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  account_id?: string;
  seller_id?: string;
  public_id?: string;
  [key: string]: unknown;
}

export interface PagBankSplit {
  method: 'FIXED';
  receivers: Array<{ account: { id: string }; amount: { value: number } }>;
}

interface PagBankAccount {
  pagbankAccessToken: string;
  pagbankRefreshToken: string | null;
  expiresAt: Date | null;
}

// Porte 1:1 de web/src/lib/pagbankToken.ts. Espelha MpTokenService.
@Injectable()
export class PagBankTokenService {
  private readonly logger = new Logger(PagBankTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformCredentials: PlatformCredentialsService,
  ) {}

  static readonly API_BASE = API_BASE;

  async authHeaders(): Promise<Record<string, string>> {
    const { token, clientId, clientSecret } = await this.platformCredentials.getPagBankCredentials();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      X_CLIENT_ID: clientId ?? '',
      X_CLIENT_SECRET: clientSecret ?? '',
    };
  }

  // O nome exato do campo que identifica a conta do vendedor não é
  // documentado publicamente — tenta os candidatos mais prováveis.
  extrairAccountId(data: PagBankTokenResponse): string | null {
    return data.account_id ?? data.seller_id ?? data.public_id ?? null;
  }

  private async renovarToken(userId: string, account: PagBankAccount): Promise<string> {
    if (!account.pagbankRefreshToken) {
      throw new Error('Sem refresh_token — promotor precisa reconectar a conta PagBank');
    }

    const res = await fetch(`${API_BASE}/oauth2/refresh`, {
      method: 'POST',
      headers: await this.authHeaders(),
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: account.pagbankRefreshToken,
      }),
    });

    const data = (await res.json().catch(() => null)) as PagBankTokenResponse | null;
    if (!res.ok || !data) throw new Error('Falha ao renovar token PagBank');

    const newExpiresAt = data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000) : null;

    await this.prisma.promotorPagbankAccount.update({
      where: { userId },
      data: {
        pagbankAccessToken: data.access_token,
        pagbankRefreshToken: data.refresh_token ?? account.pagbankRefreshToken,
        expiresAt: newExpiresAt,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`token renovado para promotor ${userId}, expira em ${newExpiresAt?.toISOString()}`);
    return data.access_token;
  }

  async getPagBankToken(userId: string): Promise<string | null> {
    const account = await this.prisma.promotorPagbankAccount.findUnique({
      where: { userId },
      select: { pagbankAccessToken: true, pagbankRefreshToken: true, expiresAt: true },
    });
    if (!account) return null;

    const precisaRenovar = account.expiresAt && account.expiresAt.getTime() - Date.now() < RENOVAR_ANTES_DE_MS;

    if (precisaRenovar) {
      try {
        return await this.renovarToken(userId, account);
      } catch (err) {
        this.logger.error('falha ao renovar, usando token existente', err as Error);
      }
    }

    return account.pagbankAccessToken;
  }

  // Resolve o split de pagamento pro dono do evento: {feePct}% pra conta da
  // Tipo7, o restante pra conta PagBank conectada do promotor. Retorna null
  // se o promotor não tiver conta conectada — quem chamar deve bloquear o
  // checkout nesse caso, nunca cair de volta pra conta única da Tipo7.
  async resolvePagBankSplit(ownerId: string, totalCentavos: number): Promise<PagBankSplit | null> {
    const { accountId: platformAccountId } = await this.platformCredentials.getPagBankCredentials();
    if (!platformAccountId) return null;

    const conta = await this.prisma.promotorPagbankAccount.findUnique({
      where: { userId: ownerId },
      select: { pagbankAccountId: true, feePct: true },
    });
    if (!conta?.pagbankAccountId) return null;

    const feePct = Number(conta.feePct ?? 10);
    const platformAmount = Math.round((totalCentavos * feePct) / 100);
    const promoterAmount = totalCentavos - platformAmount;

    return {
      method: 'FIXED',
      receivers: [
        { account: { id: conta.pagbankAccountId }, amount: { value: promoterAmount } },
        { account: { id: platformAccountId }, amount: { value: platformAmount } },
      ],
    };
  }
}
