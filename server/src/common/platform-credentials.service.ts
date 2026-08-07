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

// mp_conta_ativa: '1' ou '2' — qual das duas contas abaixo o app usa de
// verdade (checkout, fluxo de conexão OAuth dos promotores, webhook). As
// chaves sem sufixo continuam sendo a "Conta 1" (nomes originais, sem
// migração de dado nenhuma) — "Conta 2" é só um segundo jogo de campos,
// pensado pra troca rápida se a conta 1 for bloqueada/precisar trocar
// (achado real, 07/08/2026: conta 1 bloqueada via decisão judicial).
export const MP_CRED_KEYS = [
  'mp_conta_ativa',
  'mp_access_token', 'mp_public_key', 'mp_client_id', 'mp_client_secret', 'mp_webhook_secret',
  'mp_access_token_2', 'mp_public_key_2', 'mp_client_id_2', 'mp_client_secret_2', 'mp_webhook_secret_2',
];
// pagbank_token_sandbox: chave órfã achada direto no banco de produção
// (Fase 7.2, G3) — nenhum código lê/escreve ela hoje, mas é um token, então
// entra na lista de exclusão por segurança (GET /platform-settings/public
// exclui tudo daqui). Se algum dia reativar o modo sandbox do PagBank de
// verdade, essa chave já está coberta.
export const PAGBANK_CRED_KEYS = ['pagbank_token', 'pagbank_token_sandbox', 'pagbank_account_id', 'pagbank_client_id', 'pagbank_client_secret'];

@Injectable()
export class PlatformCredentialsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMpCredentials(): Promise<MpPlatformCredentials> {
    const rows = await this.prisma.platformSetting.findMany({ where: { key: { in: MP_CRED_KEYS } } });
    const s: Record<string, string> = {};
    for (const row of rows) if (row.value) s[row.key] = row.value;

    // Conta ativa: '2' só se explicitamente marcada — default é '1' (mesmo
    // comportamento de sempre, nomes de chave sem sufixo).
    const sufixo = s['mp_conta_ativa'] === '2' ? '_2' : '';

    return {
      accessToken: s[`mp_access_token${sufixo}`] || process.env.MP_ACCESS_TOKEN!,
      publicKey: s[`mp_public_key${sufixo}`] || process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || null,
      clientId: s[`mp_client_id${sufixo}`] || process.env.MP_CLIENT_ID || null,
      clientSecret: s[`mp_client_secret${sufixo}`] || process.env.MP_CLIENT_SECRET || null,
      webhookSecret: s[`mp_webhook_secret${sufixo}`] || process.env.MP_WEBHOOK_SECRET || null,
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
