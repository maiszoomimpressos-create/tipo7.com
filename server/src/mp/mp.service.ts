import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { MpTokenService } from '../common/mp-token.service';
import { PlatformCredentialsService } from '../common/platform-credentials.service';
import { PrismaService } from '../prisma/prisma.service';

// Antes hardcoded sem "www" (https://tipo7.com) — ficou desatualizado da
// migração de hospedagem (Vercel -> VPS/EasyPanel), que passou a
// canonicalizar tudo pra www.tipo7.com (tipo7.com bare vira 301/308).
// Corrigido pra usar a mesma env var que PagBank/Google OAuth já usavam
// (achado real, 07/08/2026, ao cadastrar uma segunda conta MP do zero —
// ver PlatformCredentialsService/MP_CRED_KEYS).
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tipo7.com';
const REDIRECT_URI = `${BASE}/api/mp/callback`;

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

  // Compara o user_id da conta que acabou de autorizar contra as duas
  // contas MP da PRÓPRIA Tipo7 (Conta 1 e Conta 2, platform_settings) —
  // achado real (08/08/2026): nada no fluxo de OAuth impede um promotor de
  // conectar acidentalmente a mesma conta que já é da plataforma (aconteceu
  // 2x nesta sessão, com contas de teste diferentes). O Mercado Pago só
  // acusa isso na hora de gerar o pagamento ("You cannot use
  // application_fee with this payment", código 2059) — mensagem opaca pro
  // usuário final. Bloqueando aqui, na conexão, com mensagem clara.
  private async ehContaDaPropriaPlataforma(mpUserId: string): Promise<boolean> {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: ['mp_access_token', 'mp_access_token_2'] } },
    });
    // Formato do token: APP_USR-{app_id}-{data}-{hash}-{user_id} — o
    // user_id é sempre o último segmento separado por hífen.
    const idsPlataforma = rows
      .map((r) => r.value?.split('-').pop())
      .filter((id): id is string => !!id);
    return idsPlataforma.includes(mpUserId);
  }

  private async buscarNomeConta(accessToken: string): Promise<string | null> {
    try {
      const res = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { first_name?: string; last_name?: string; nickname?: string };
      const nome = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
      return nome || data.nickname || null;
    } catch (err) {
      this.logger.error('[mp] erro ao buscar nome da conta', err as Error);
      return null;
    }
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

    if (await this.ehContaDaPropriaPlataforma(String(token.user_id))) {
      this.logger.warn(`[mp] promotor ${userId} tentou conectar uma conta MP que já é da plataforma (${token.user_id})`);
      return `${BASE}${destino}${destino.includes('?') ? '&' : '?'}mp_erro=conta_propria`;
    }

    const expiresAt = new Date(Date.now() + token.expires_in * 1000);
    const nomeConta = await this.buscarNomeConta(token.access_token);

    try {
      await this.prisma.promotorMpAccount.upsert({
        where: { userId },
        create: {
          userId,
          mpUserId: BigInt(token.user_id),
          mpAccountName: nomeConta,
          mpAccessToken: token.access_token,
          mpRefreshToken: token.refresh_token,
          mpPublicKey: token.public_key,
          expiresAt,
        },
        update: {
          mpUserId: BigInt(token.user_id),
          mpAccountName: nomeConta,
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
      select: { mpUserId: true, mpAccountName: true, feePct: true, expiresAt: true, updatedAt: true },
    });
    if (!data) return { connected: false };

    const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
    const expiresIn = data.expiresAt ? data.expiresAt.getTime() - Date.now() : null;
    const tokenExpirando = expiresIn !== null && expiresIn < SETE_DIAS_MS;

    return {
      connected: true,
      // BigInt não serializa em JSON — precisa virar string na resposta.
      mpUserId: data.mpUserId.toString(),
      accountName: data.mpAccountName,
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
