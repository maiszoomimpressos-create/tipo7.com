import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import type { CookieOptions, Request, Response } from 'express';

// Porte 1:1 de web/src/lib/areaRestrita.ts.
// Step-up auth da área restrita (Equipe, Financeiro, API) — cada pessoa com
// acesso_restrito=true também cadastra uma senha própria (separada da senha
// de login) e precisa digitá-la pra desbloquear essas telas. Desbloqueio
// dura 30 min por sessão de navegador, guardado num cookie assinado (HMAC).
const COOKIE_NAME = 'area_restrita_unlock';
const DURACAO_MS = 30 * 60 * 1000;

@Injectable()
export class AreaRestritaService {
  private readonly segredo: string;

  // Nome próprio (não QR_SECRET) porque no web/ essa variável também assina
  // os tokens de QR de ingresso — aqui só cuida do cookie de área restrita,
  // não precisa (nem deve) ser o mesmo segredo nem o mesmo valor de produção:
  // o cookie é emitido e validado sempre pelo mesmo sistema.
  constructor(config: ConfigService) {
    this.segredo = config.getOrThrow<string>('AREA_RESTRITA_SECRET');
  }

  // ── Hash da senha própria (scrypt) ──────────────────────────────────────

  hashSenha(senha: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(senha, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  verificarSenha(senha: string, hashArmazenado: string): boolean {
    const [salt, hash] = hashArmazenado.split(':');
    if (!salt || !hash) return false;
    const hashTentativa = scryptSync(senha, salt, 64);
    const hashOriginal = Buffer.from(hash, 'hex');
    if (hashTentativa.length !== hashOriginal.length) return false;
    return timingSafeEqual(hashTentativa, hashOriginal);
  }

  // ── Token de desbloqueio assinado (HMAC) ────────────────────────────────

  private assinar(payload: string): string {
    return createHmac('sha256', this.segredo).update(payload).digest('hex');
  }

  private criarToken(userId: string): string {
    const expiresAt = Date.now() + DURACAO_MS;
    const payload = `${userId}:${expiresAt}`;
    return `${payload}:${this.assinar(payload)}`;
  }

  private tokenValido(token: string, userId: string): boolean {
    const partes = token.split(':');
    if (partes.length !== 3) return false;
    const [tokenUserId, expiresAtStr, assinatura] = partes;
    if (tokenUserId !== userId) return false;

    const payload = `${tokenUserId}:${expiresAtStr}`;
    const esperada = this.assinar(payload);
    if (esperada.length !== assinatura.length) return false;
    if (!timingSafeEqual(Buffer.from(esperada), Buffer.from(assinatura))) return false;

    const expiresAt = Number(expiresAtStr);
    return Number.isFinite(expiresAt) && Date.now() < expiresAt;
  }

  // Mesmo achado do auth-core.controller.ts (07/08/2026): sem "domain"
  // explícito, o cookie trava no host exato (ex: www.tipo7.com) — quem
  // acaba no domínio nu (tipo7.com) perde o desbloqueio sem motivo aparente.
  private cookieDomain(): string | undefined {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) return undefined;
    try {
      const host = new URL(appUrl).hostname;
      if (host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return undefined;
      return `.${host.replace(/^www\./, '')}`;
    } catch {
      return undefined;
    }
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: DURACAO_MS,
      path: '/',
      domain: this.cookieDomain(),
    };
  }

  desbloquear(res: Response, userId: string): void {
    res.cookie(COOKIE_NAME, this.criarToken(userId), this.cookieOptions());
  }

  estaDesbloqueada(req: Request, userId: string): boolean {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return false;
    return this.tokenValido(token, userId);
  }

  bloquear(res: Response): void {
    res.clearCookie(COOKIE_NAME, { path: '/', domain: this.cookieDomain() });
  }
}
