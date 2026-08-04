import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PagBankTokenService, type PagBankTokenResponse } from '../common/pagbank-token.service';
import { PlatformCredentialsService } from '../common/platform-credentials.service';
import { PrismaService } from '../prisma/prisma.service';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tipo7.com';
const PAGBANK_ENV = process.env.PAGBANK_ENV === 'sandbox' ? 'sandbox' : 'production';
const AUTH_BASE =
  PAGBANK_ENV === 'sandbox' ? 'https://connect.sandbox.pagbank.com.br/oauth2/authorize' : 'https://connect.pagbank.com.br/oauth2/authorize';
const REDIRECT_URI = `${APP_URL}/api/pagbank/callback`;

function isInternalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');
}

// Porte 1:1 de web/src/app/api/pagbank/{auth,callback,status,refresh,disconnect}/route.ts.
// Espelha mp.service.ts.
@Injectable()
export class PagbankService {
  private readonly logger = new Logger(PagbankService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pagbankToken: PagBankTokenService,
    private readonly platformCredentials: PlatformCredentialsService,
  ) {}

  async buildAuthorizeUrl(rawReturnTo: string): Promise<{ url: string; csrfState: string }> {
    const returnTo = isInternalPath(rawReturnTo) ? rawReturnTo : '';
    const csrfState = randomBytes(16).toString('hex');
    const state = returnTo ? `${csrfState}::${returnTo}` : csrfState;

    const { clientId } = await this.platformCredentials.getPagBankCredentials();

    const url = new URL(AUTH_BASE);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId ?? '');
    url.searchParams.set('redirect_uri', REDIRECT_URI);
    url.searchParams.set('scope', 'payments.read payments.create accounts.read');
    url.searchParams.set('state', state);

    return { url: url.toString(), csrfState };
  }

  async handleCallback(params: {
    code: string | undefined;
    state: string | undefined;
    erro: string | undefined;
    erroDescricao: string | undefined;
    stateGuardado: string | undefined;
    userId: string | undefined;
  }): Promise<string> {
    const { code, state, erro, erroDescricao, stateGuardado, userId } = params;

    if (erro) {
      this.logger.error(`[pagbank/callback] autorização recusada pelo PagBank: ${erro} ${erroDescricao ?? ''}`);
      return `${APP_URL}/configuracoes/contas?pagbank_erro=cancelado&pb_detalhe=${encodeURIComponent(erro)}`;
    }
    if (!code || !state) return `${APP_URL}/configuracoes/contas?pagbank_erro=parametros`;

    const [csrfState, returnTo] = state.split('::');
    if (!stateGuardado || stateGuardado !== csrfState) return `${APP_URL}/configuracoes/contas?pagbank_erro=state`;

    const destino = returnTo && isInternalPath(returnTo) ? returnTo : '/configuracoes/contas';

    const tokenRes = await fetch(`${PagBankTokenService.API_BASE}/oauth2/token`, {
      method: 'POST',
      headers: await this.pagbankToken.authHeaders(),
      body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }),
    });

    const token = (await tokenRes.json().catch(() => null)) as PagBankTokenResponse | null;

    if (!tokenRes.ok || !token) {
      this.logger.error(`PagBank token error: ${tokenRes.status} ${JSON.stringify(token)}`);
      return `${APP_URL}${destino}?pagbank_erro=token`;
    }

    // Diagnóstico único: o campo que identifica a conta do vendedor não é
    // documentado publicamente — loga a resposta crua (sem os tokens) pra
    // confirmarmos o nome certo do campo assim que o primeiro promotor conectar.
    this.logger.log(`[pagbank/callback] resposta do token (diagnóstico): ${JSON.stringify({ ...token, access_token: '[omitido]', refresh_token: '[omitido]' })}`);

    if (!userId) return `${APP_URL}/auth`;

    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null;
    const accountId = this.pagbankToken.extrairAccountId(token) ?? 'desconhecida';

    try {
      await this.prisma.promotorPagbankAccount.upsert({
        where: { userId },
        create: {
          userId,
          pagbankAccountId: accountId,
          pagbankAccessToken: token.access_token,
          pagbankRefreshToken: token.refresh_token ?? null,
          expiresAt,
        },
        update: {
          pagbankAccountId: accountId,
          pagbankAccessToken: token.access_token,
          pagbankRefreshToken: token.refresh_token ?? null,
          expiresAt,
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error('DB upsert error (pagbank)', err as Error);
      return `${APP_URL}${destino}?pagbank_erro=banco`;
    }

    const separador = destino.includes('?') ? '&' : '?';
    return `${APP_URL}${destino}${separador}pagbank_ok=1`;
  }

  async status(userId: string) {
    const data = await this.prisma.promotorPagbankAccount.findUnique({
      where: { userId },
      select: { pagbankAccountId: true, feePct: true, expiresAt: true, updatedAt: true },
    });
    if (!data) return { connected: false };

    const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
    const expiresIn = data.expiresAt ? data.expiresAt.getTime() - Date.now() : null;
    const tokenExpirando = expiresIn !== null && expiresIn < SETE_DIAS_MS;

    return {
      connected: true,
      accountId: data.pagbankAccountId,
      feePct: data.feePct,
      expiresAt: data.expiresAt,
      updatedAt: data.updatedAt,
      tokenExpirando,
    };
  }

  async refresh(userId: string) {
    await this.prisma.promotorPagbankAccount.updateMany({ where: { userId }, data: { expiresAt: new Date(0) } });

    const token = await this.pagbankToken.getPagBankToken(userId);
    if (!token) throw new NotFoundException('Conta PagBank não conectada');

    const data = await this.prisma.promotorPagbankAccount.findUnique({ where: { userId }, select: { expiresAt: true } });
    return { ok: true, expiresAt: data?.expiresAt };
  }

  async disconnect(userId: string) {
    await this.prisma.promotorPagbankAccount.deleteMany({ where: { userId } });
    return { ok: true };
  }
}
