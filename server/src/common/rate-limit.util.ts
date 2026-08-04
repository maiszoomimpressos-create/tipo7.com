import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';

// Porte de web/src/lib/rateLimit.ts (rateLimitLocal/getIp/tooManyRequests) —
// em memória, zero latência, não compartilha contador entre instâncias.
// Serve pra endpoints de baixo risco (mesmo critério usado no original).
const windows = new Map<string, number[]>();

export function rateLimitLocal(ip: string, key: string, max: number, windowMs: number): boolean {
  const k = `${key}:${ip}`;
  const now = Date.now();
  const prev = windows.get(k) ?? [];
  const valid = prev.filter((t) => now - t < windowMs);
  valid.push(now);
  windows.set(k, valid);
  return valid.length <= max;
}

export function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return first?.trim() || (req.headers['x-real-ip'] as string) || req.ip || '0.0.0.0';
}

export function tooManyRequests(): never {
  throw new HttpException('Muitas tentativas. Aguarde um momento.', HttpStatus.TOO_MANY_REQUESTS);
}
