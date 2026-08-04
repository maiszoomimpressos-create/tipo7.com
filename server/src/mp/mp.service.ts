import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { MpTokenService } from '../common/mp-token.service';
import { PlatformCredentialsService } from '../common/platform-credentials.service';
import { PrismaService } from '../prisma/prisma.service';

const REDIRECT_URI = 'https://tipo7.com/api/mp/callback';
const BASE = 'https://tipo7.com';

// Aceita apenas caminhos internos (evita open redirect via //evil.com ou /\evil.com)
function isInternalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');
}

// Porte 1:1 de web/src/app/api/mp/{auth,callback,status,refresh,disconnect}/route.ts.
@Injectable()
export class MpService {
  private readonly logger = new Logger(MpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformCredentials: PlatformCredentialsService,
    private readonly mpToken: MpTokenService,
  ) {}

  async buildAuthorizeUrl(rawReturnTo: string): Promise<{ url: string; csrfState: string }> {
    const returnTo = isInternalPath(rawReturnTo) ? rawReturnTo : '';
    const csrfState = randomBytes(16).toString('hex');
    const state = returnTo ? `${csrfState}::${returnTo}` : csrfState;

    const { clientId } = await this.platformCredentials.getMpCredentials();

    const url = new URL('https://auth.mercadopago.com.br/authorization');
    url.searchParams.set('client_id', clientId ?? '');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('platform_id', 'mp');
    url.searchParams.set('redirect_uri', REDIRECT_URI);
    url.searchParams.set('state', state);

    return { url: url.toString(), csrfState };
  }

  // Retorna sempre a URL de destino final (sucesso ou erro) — a rota nunca
  // devolve JSON, sempre redireciona (mesmo comportamento do original).
  async handleCallback(params: {
    code: string | undefined;
    state: string | undefined;
    erro: string | undefined;
    stateGuardado: string | undefined;
    userId: string | undefined;
  }): Promise<string> {
    const { code, state, erro, stateGuardado, userId } = params;

    if (erro) return `${BASE}/configuracoes/contas?mp_erro=cancelado`;
    if (!code || !state) return `${BASE}/configuracoes/contas?mp_erro=parametros`;

    const [csrfState, returnTo] = state.split('::');
    if (!stateGuardado || stateGuardado !== csrfState) return `${BASE}/configuracoes/contas?mp_erro=state`;

    const destino = returnTo && isInternalPath(returnTo) ? returnTo : '/configuracoes/contas';

    const { clientId, clientSecret } = await this.platformCredentials.getMpCredentials();

    const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      this.logger.error(`MP token error: ${await tokenRes.text()}`);
      return `${BASE}/configuracoes/contas?mp_erro=token`;
    }

    const token = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      user_id: number;
      public_key: string;
      expires_in: number;
    };

    if (!userId) return `${BASE}/auth`;

    const expiresAt = new Date(Date.now() + token.expires_in * 1000);

    try {
      await this.prisma.promotorMpAccount.upsert({
        where: { userId },
        create: {
          userId,
          mpUserId: BigInt(token.user_id),
          mpAccessToken: token.access_token,
          mpRefreshToken: token.refresh_token,
          mpPublicKey: token.public_key,
          expiresAt,
        },
        update: {
          mpUserId: BigInt(token.user_id),
          mpAccessToken: token.access_token,
          mpRefreshToken: token.refresh_token,
          mpPublicKey: token.public_key,
          expiresAt,
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error('DB upsert error', err as Error);
      return `${BASE}${destino}?mp_erro=banco`;
    }

    const separador = destino.includes('?') ? '&' : '?';
    return `${BASE}${destino}${separador}mp_ok=1`;
  }

  async status(userId: string) {
    const data = await this.prisma.promotorMpAccount.findUnique({
      where: { userId },
      select: { mpUserId: true, feePct: true, expiresAt: true, updatedAt: true },
    });
    if (!data) return { connected: false };

    const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
    const expiresIn = data.expiresAt ? data.expiresAt.getTime() - Date.now() : null;
    const tokenExpirando = expiresIn !== null && expiresIn < SETE_DIAS_MS;

    return {
      connected: true,
      // BigInt não serializa em JSON — precisa virar string na resposta.
      mpUserId: data.mpUserId.toString(),
      feePct: data.feePct,
      expiresAt: data.expiresAt,
      updatedAt: data.updatedAt,
      tokenExpirando,
    };
  }

  async refresh(userId: string) {
    // updateMany (não update): zero linhas afetadas se a conta não existir
    // não deve lançar — mesmo comportamento silencioso do .update() do Supabase.
    await this.prisma.promotorMpAccount.updateMany({ where: { userId }, data: { expiresAt: new Date(0) } });

    const token = await this.mpToken.getMpToken(userId);
    if (!token) throw new NotFoundException('Conta MP não conectada');

    const data = await this.prisma.promotorMpAccount.findUnique({ where: { userId }, select: { expiresAt: true } });
    return { ok: true, expiresAt: data?.expiresAt };
  }

  async disconnect(userId: string) {
    await this.prisma.promotorMpAccount.deleteMany({ where: { userId } });
    return { ok: true };
  }
}
