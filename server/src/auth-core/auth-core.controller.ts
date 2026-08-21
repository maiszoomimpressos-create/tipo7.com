import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { RateLimitDbService } from '../common/rate-limit-db.service';
import { getIp } from '../common/rate-limit.util';
import { AuthCoreService, type PinLoginResult, type RegisterInput, type SessionResult } from './auth-core.service';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const GOOGLE_STATE_COOKIE = 'google_oauth_state';
const GOOGLE_NEXT_COOKIE = 'google_oauth_next';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tipo7.com';
const GOOGLE_REDIRECT_URI = `${APP_URL}/api/auth/google/callback`;

function isInternalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');
}

// Achado real (07/08/2026): os cookies de sessão eram gravados sem "domain"
// explícito — por padrão, o browser trava o cookie no host EXATO que
// respondeu o request (ex: www.tipo7.com). Se por qualquer motivo o
// visitante acaba no domínio nu (tipo7.com, sem www — cache de link antigo,
// digitação direta, etc.), o browser trata como origem DIFERENTE: nenhum
// cookie de lá é enviado, aparenta estar deslogado mesmo tendo feito login
// segundos antes. Com "domain: .tipo7.com" (ponto na frente) o cookie vale
// pro apex E pra qualquer subdomínio, então não importa qual dos dois o
// browser decidiu usar.
//
// Achado real #2 (12/08/2026): essa função ainda derivava o host de
// APP_URL, que server/.env mantém fixo em https://www.tipo7.com mesmo
// rodando local (ver secureCookies() abaixo — mesmo motivo, redirect_uri do
// Google). Resultado: local também recebia "Domain=.tipo7.com" no cookie —
// e isso não é só "não ajuda", é o suficiente pro navegador REJEITAR o
// cookie inteiro (Domain não bate com o host real que respondeu, localhost).
// Confirmado direto no header Set-Cookie via curl. Mesmo fix de NODE_ENV:
// só monta Domain explícito em produção.
function cookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined;
  try {
    const host = new URL(APP_URL).hostname;
    if (host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return undefined;
    return `.${host.replace(/^www\./, '')}`;
  } catch {
    return undefined;
  }
}

// Achado real (12/08/2026): cookie com "Secure" só é aceito pelo navegador
// em origem https — em dev local, o Next.js roda em http://localhost, então
// todo cookie de sessão marcado "secure: true" era descartado silenciosamente
// assim que o browser recebia a resposta. Sintoma: login parecia funcionar
// (resposta 200, corpo com os dados do usuário, One Tap até mostra o nome)
// mas a sessão "desconectava" na próxima navegação — nenhum cookie de fato
// foi gravado.
//
// Primeira tentativa de fix derivava isso de APP_URL (mesmo raciocínio do
// cookieDomain() acima) — não funcionou: server/.env mantém
// NEXT_PUBLIC_APP_URL=https://www.tipo7.com MESMO rodando local (é o valor
// certo pra montar GOOGLE_REDIRECT_URI, que precisa bater com o registrado
// no Google Cloud Console — só produção tem isso registrado, login Google
// via redirect completo não funciona local de qualquer forma; só o One Tap,
// que não usa redirect_uri, funciona nos dois ambientes). Ou seja, usar
// APP_URL aqui misturava dois sentidos diferentes de "ambiente" que
// divergem de propósito neste projeto. NODE_ENV é o sinal certo: só o
// Dockerfile (build de produção) seta NODE_ENV=production; local
// (`nest start --watch`) não seta nada.
function secureCookies(): boolean {
  return process.env.NODE_ENV === 'production';
}

// Achado real (07/08/2026, mesma sessão do fix de domain acima): quem já
// tinha um refresh_token gravado ANTES desse fix ficou com DUAS versões do
// cookie ao mesmo tempo — a antiga (sem domain, presa em www.tipo7.com) e a
// nova (domain=.tipo7.com). Pro browser são cookies DIFERENTES (chave inclui
// o domain), então limpar só a nova nunca apagava a velha. O navegador manda
// as duas no header Cookie e o cookie-parser do Express só guarda uma
// (a ordem não é garantida) — se pegar a antiga (já revogada pela rotação),
// o refresh falha com 401 mesmo a sessão sendo válida. Toda emissão de
// cookie agora limpa explicitamente a variante sem domain primeiro, pra
// essa duplicata nunca sobreviver a um novo login/refresh.
function clearLegacyHostOnlyCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

function setSessionCookies(res: Response, session: SessionResult) {
  clearLegacyHostOnlyCookies(res);
  const base: CookieOptions = { secure: secureCookies(), sameSite: 'lax', domain: cookieDomain() };
  // access_token: legível por JS de propósito (vida curta, 1h) — o frontend
  // lê direto do cookie pra hidratar a sessão sem round-trip extra, e o
  // apiFetchAuth continua anexando via Authorization: Bearer como sempre.
  res.cookie(ACCESS_COOKIE, session.accessToken, { ...base, httpOnly: false, maxAge: session.expiresIn * 1000, path: '/' });
  // refresh_token: httpOnly sempre — só o endpoint /auth/refresh (e /auth/logout) lê.
  // Path precisa ser '/api/auth' (não '/auth'): o browser sempre chama a rota
  // pelo caminho público do Next.js (rewrite de /api/auth/* pro NestJS), então
  // é esse o path que o cookie jar usa pra decidir se manda o cookie ou não —
  // '/auth' (nome da rota dentro do NestJS) nunca aparece na barra de endereço.
  res.cookie(REFRESH_COOKIE, session.refreshToken, { ...base, httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, path: '/api/auth' });
}

function clearSessionCookies(res: Response) {
  const domain = cookieDomain();
  res.clearCookie(ACCESS_COOKIE, { path: '/', domain });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth', domain });
  clearLegacyHostOnlyCookies(res);
}

function toResponseBody<T extends SessionResult>(session: T): Omit<T, 'refreshToken'> {
  // refreshToken nunca vai no corpo — só existe como cookie httpOnly.
  const { refreshToken: _refreshToken, ...body } = session;
  return body;
}

// Porte de web/src/contexts/AuthContext.tsx (server-side) + web/src/app/api/auth/google/**
// pro NestJS — AuthModule próprio (Fase 6), substitui o Supabase Auth por
// completo. Ver server/src/auth-core/auth-core.service.ts pro desenho de
// tokens (access JWT curto + refresh token opaco revogável).
@Controller('auth')
export class AuthCoreController {
  constructor(
    private readonly authCore: AuthCoreService,
    private readonly rateLimitDb: RateLimitDbService,
  ) {}

  @Post('register')
  async register(@Res({ passthrough: true }) res: Response, @Body() body: RegisterInput) {
    const session = await this.authCore.register(body);
    setSessionCookies(res, session);
    return toResponseBody(session);
  }

  @Post('login')
  async login(@Res({ passthrough: true }) res: Response, @Body() body: { email?: string; password?: string }) {
    const session = await this.authCore.login(body.email, body.password);
    setSessionCookies(res, session);
    return toResponseBody(session);
  }

  // Rota pública /caixa (web) — login alternativo por token+PIN pra PC
  // compartilhado/maquininha, ver project_token_pin_acesso_caixa na memória.
  // Rate limit via banco (mesmo padrão de cpf-confirmar): é literalmente
  // "tentar adivinhar" um PIN curto, precisa valer entre instâncias. O
  // bloqueio por PIN errado em si (por staff, não por IP) é tratado dentro
  // de authCore.loginComTokenPin.
  @Post('entrar-com-pin')
  async entrarComPin(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { token?: string; pin?: string },
  ): Promise<Omit<PinLoginResult, 'refreshToken'>> {
    await this.rateLimitDb.enforce(getIp(req), 'entrar-com-pin', 10, 5 * 60_000);
    const session = await this.authCore.loginComTokenPin(body.token, body.pin);
    setSessionCookies(res, session);
    return toResponseBody(session);
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.authCore.refresh(req.cookies?.[REFRESH_COOKIE]);
    setSessionCookies(res, session);
    return toResponseBody(session);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authCore.logout(req.cookies?.[REFRESH_COOKIE]);
    clearSessionCookies(res);
    return { ok: true };
  }

  @UseGuards(SupabaseJwtGuard)
  @Get('session')
  session(@CurrentUser() user: AuthenticatedUser) {
    return { user: { id: user.id, email: user.email, fullName: user.fullName } };
  }

  @UseGuards(SupabaseJwtGuard)
  @Post('verify-password')
  async verifyPassword(@CurrentUser() user: AuthenticatedUser, @Body() body: { password?: string }) {
    const ok = body.password ? await this.authCore.verifyPassword(user.id, body.password) : false;
    return { ok };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email?: string }) {
    await this.authCore.forgotPassword(body.email);
    return { ok: true };
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token?: string; password?: string }) {
    await this.authCore.resetPassword(body.token, body.password);
    return { ok: true };
  }

  @Post('google/onetap')
  async googleOneTap(@Res({ passthrough: true }) res: Response, @Body() body: { idToken?: string; nonce?: string }) {
    if (!body.idToken) return { error: 'idToken obrigatório' };
    const session = await this.authCore.loginWithGoogle(body.idToken, body.nonce);
    setSessionCookies(res, session);
    return toResponseBody(session);
  }

  // GET /auth/google?next=/caminho-interno — mesmo padrão de mp/pagbank auth
  // (Fase 4): state anti-CSRF num cookie httpOnly de curta duração.
  @Get('google')
  googleAuth(@Res() res: Response, @Query('next') next?: string) {
    const rawNext = next ?? '';
    const isInternal = isInternalPath(rawNext);
    const nextPath = isInternal ? rawNext : '/';

    const state = randomBytes(16).toString('hex');
    res.cookie(GOOGLE_STATE_COOKIE, state, { httpOnly: true, secure: secureCookies(), sameSite: 'lax', maxAge: 600_000, path: '/' });
    res.cookie(GOOGLE_NEXT_COOKIE, nextPath, { httpOnly: true, secure: secureCookies(), sameSite: 'lax', maxAge: 600_000, path: '/' });

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID ?? '');
    url.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'online');
    url.searchParams.set('prompt', 'select_account');

    return res.redirect(url.toString());
  }

  @Get('google/callback')
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') erro?: string,
  ) {
    const storedState = req.cookies?.[GOOGLE_STATE_COOKIE];
    const next = req.cookies?.[GOOGLE_NEXT_COOKIE] || '/';
    res.clearCookie(GOOGLE_STATE_COOKIE, { path: '/' });
    res.clearCookie(GOOGLE_NEXT_COOKIE, { path: '/' });

    const fail = (msg: string) => res.redirect(`${APP_URL}/auth?erro=${msg}`);

    if (erro || !code) return fail('google_cancelled');
    if (!storedState || storedState !== state) return fail('csrf');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        code,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail('google_token');

    const { id_token } = (await tokenRes.json()) as { id_token?: string };
    if (!id_token) return fail('no_id_token');

    try {
      const session = await this.authCore.loginWithGoogle(id_token);
      setSessionCookies(res, session);
      return res.redirect(`${APP_URL}${next}`);
    } catch {
      return fail('google_session');
    }
  }
}
