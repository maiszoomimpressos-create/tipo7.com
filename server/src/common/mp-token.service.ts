import { Injectable, Logger } from '@nestjs/common';
import { PlatformCredentialsService } from './platform-credentials.service';
import { PrismaService } from '../prisma/prisma.service';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tipo7.com';
const RENOVAR_ANTES_DE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

// Porte 1:1 de web/src/lib/mpToken.ts — tokens OAuth do Mercado Pago dos
// promotores, renovados automaticamente quando faltam menos de 7 dias.
@Injectable()
export class MpTokenService {
  private readonly logger = new Logger(MpTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformCredentials: PlatformCredentialsService,
  ) {}

  private async renovarToken(userId: string, account: { mpRefreshToken: string | null }): Promise<string> {
    if (!account.mpRefreshToken) {
      throw new Error('Sem refresh_token — promotor precisa reconectar a conta MP');
    }

    const { clientId, clientSecret } = await this.platformCredentials.getMpCredentials();

    const res = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: account.mpRefreshToken,
        redirect_uri: `${APP_URL}/api/mp/callback`,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? data.error ?? 'Falha ao renovar token MP');

    const newExpiresAt = data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000) : null;

    await this.prisma.promotorMpAccount.update({
      where: { userId },
      data: {
        mpAccessToken: data.access_token,
        mpRefreshToken: data.refresh_token ?? account.mpRefreshToken,
        mpPublicKey: data.public_key ?? null,
        expiresAt: newExpiresAt,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`token renovado para promotor ${userId}, expira em ${newExpiresAt?.toISOString()}`);
    return data.access_token as string;
  }

  async getMpToken(userId: string): Promise<string | null> {
    const account = await this.prisma.promotorMpAccount.findUnique({
      where: { userId },
      select: { mpAccessToken: true, mpRefreshToken: true, expiresAt: true },
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

    return account.mpAccessToken;
  }
}
