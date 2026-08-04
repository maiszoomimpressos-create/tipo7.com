import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Rate limit centralizado via banco (function SQL check_rate_limit) —
// funciona entre todas as instâncias, ao contrário do rate limit em
// memória (rateLimitLocal em common/rate-limit.util.ts). Fail-open em
// caso de erro do banco (não derruba o serviço).
@Injectable()
export class RateLimitDbService {
  constructor(private readonly prisma: PrismaService) {}

  async check(ip: string, key: string, max: number, windowMs: number): Promise<boolean> {
    try {
      const windowSeconds = Math.ceil(windowMs / 1000);
      const rows = await this.prisma.$queryRaw<{ check_rate_limit: boolean }[]>`
        SELECT check_rate_limit(${ip}, ${key}, ${max}, ${windowSeconds})
      `;
      return rows[0]?.check_rate_limit === true;
    } catch {
      return true;
    }
  }

  async enforce(ip: string, key: string, max: number, windowMs: number): Promise<void> {
    if (!(await this.check(ip, key, max, windowMs))) {
      throw new HttpException('Muitas tentativas. Aguarde um momento.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
