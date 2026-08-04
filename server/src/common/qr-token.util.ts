// Porte 1:1 de web/src/lib/qrToken.ts.
import { createHmac, randomBytes } from 'crypto';

export function gerarQrToken(): string {
  const secret = process.env.QR_SECRET;
  if (!secret) throw new Error('QR_SECRET não configurado');
  const nonce = randomBytes(16).toString('hex');
  return createHmac('sha256', secret).update(nonce).digest('hex');
}
