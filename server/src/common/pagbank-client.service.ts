import { Injectable } from '@nestjs/common';
import { PlatformCredentialsService } from './platform-credentials.service';

const PAGBANK_ENV = process.env.PAGBANK_ENV === 'sandbox' ? 'sandbox' : 'production';

export const PAGBANK_BASE_URL = PAGBANK_ENV === 'sandbox' ? 'https://sandbox.api.pagseguro.com' : 'https://api.pagseguro.com';

// Host separado — a API de chave pública (usada pra criptografar cartão no
// navegador) vive sob "assinaturas", não sob a API de Orders, mesmo sendo
// usada por qualquer criação de pedido com cartão (confirmado testando
// contra o sandbox).
export const PAGBANK_ASSINATURAS_BASE_URL =
  PAGBANK_ENV === 'sandbox' ? 'https://sandbox.api.assinaturas.pagseguro.com' : 'https://api.assinaturas.pagseguro.com';

export class PagBankError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `PagBank HTTP ${status}`);
    this.name = 'PagBankError';
  }
}

// Porte 1:1 de web/src/lib/pagbankClient.ts.
@Injectable()
export class PagBankClientService {
  constructor(private readonly platformCredentials: PlatformCredentialsService) {}

  async headers(idempotencyKey?: string): Promise<Record<string, string>> {
    const { token } = await this.platformCredentials.getPagBankCredentials();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    return headers;
  }

  async post<T = unknown>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    const res = await fetch(`${PAGBANK_BASE_URL}${path}`, {
      method: 'POST',
      headers: await this.headers(idempotencyKey),
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new PagBankError(res.status, data);
    return data as T;
  }

  async getPublicKey(): Promise<string | null> {
    const res = await fetch(`${PAGBANK_ASSINATURAS_BASE_URL}/public-keys`, {
      method: 'PUT',
      headers: await this.headers(),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { public_key?: string } | null;
    return data?.public_key ?? null;
  }
}
