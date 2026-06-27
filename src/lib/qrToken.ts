// Geração segura de tokens para QR codes de ingressos.
// Usa HMAC-SHA256 com segredo do servidor — impossível de adivinhar
// sem conhecer a chave QR_SECRET.
import { createHmac, randomBytes } from 'crypto'

export function gerarQrToken(): string {
  const secret = process.env.QR_SECRET
  if (!secret) throw new Error('QR_SECRET não configurado')
  const nonce = randomBytes(16).toString('hex')
  return createHmac('sha256', secret).update(nonce).digest('hex')
}
