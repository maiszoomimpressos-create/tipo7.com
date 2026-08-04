import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Porte 1:1 de web/src/lib/platformCredentials.ts. Fonte de verdade é
// platform_settings (editável em Admin > Financeiro > Bancos > Gateways) —
// variável de ambiente vira só o fallback.
export interface MpPlatformCredentials {
  accessToken: string;
  publicKey: string | null;
  clientId: string | null;
  clientSecret: string | null;
  webhookSecret: string | null;
}

export interface PagBankPlatformCredentials {
  token: string | null;
  accountId: string | null;
  clientId: string | null;
  clientSecret: string | null;
}

export const MP_CRED_KEYS = ['mp_access_token', 'mp_public_key', 'mp_client_id', 'mp_client_secret', 'mp_webhook_secret'];
export const PAGBANK_CRED_KEYS = ['pagbank_token', 'pagbank_account_id', 'pagbank_client_id', 'pagbank_client_secret'];

@Injectable()
export class PlatformCredentialsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMpCredentials(): Promise<MpPlatformCredentials> {
    const rows = await this.prisma.platformSetting.findMany({ where: { key: { in: MP_CRED_KEYS } } });
    const s: Record<string, string> = {};
    for (const row of rows) if (row.value) s[row.key] = row.value;

    return {
      accessToken: s['mp_access_token'] || process.env.MP_ACCESS_TOKEN!,
      publicKey: s['mp_public_key'] || process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || null,
      clientId: s['mp_client_id'] || process.env.MP_CLIENT_ID || null,
      clientSecret: s['mp_client_secret'] || process.env.MP_CLIENT_SECRET || null,
      webhookSecret: s['mp_webhook_secret'] || process.env.MP_WEBHOOK_SECRET || null,
    };
  }

  async getPagBankCredentials(): Promise<PagBankPlatformCredentials> {
    const rows = await this.prisma.platformSetting.findMany({ where: { key: { in: PAGBANK_CRED_KEYS } } });
    const s: Record<string, string> = {};
    for (const row of rows) if (row.value) s[row.key] = row.value;

    return {
      token: s['pagbank_token'] || process.env.PAGBANK_TOKEN || null,
      accountId: s['pagbank_account_id'] || process.env.PAGBANK_ACCOUNT_ID || null,
      clientId: s['pagbank_client_id'] || process.env.PAGBANK_CLIENT_ID || null,
      clientSecret: s['pagbank_client_secret'] || process.env.PAGBANK_CLIENT_SECRET || null,
    };
  }
}
