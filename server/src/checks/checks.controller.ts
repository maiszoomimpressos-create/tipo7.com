import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { getIp, rateLimitLocal, tooManyRequests } from '../common/rate-limit.util';
import { PrismaService } from '../prisma/prisma.service';

function cpfValido(cpf: string): boolean {
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(cpf[10], 10);
}

@Controller()
export class ChecksController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('check-cpf')
  async checkCpf(@Req() req: Request, @Query('cpf') cpfParam?: string) {
    if (!rateLimitLocal(getIp(req), 'check-cpf', 5, 60_000)) tooManyRequests();

    const cpf = cpfParam?.replace(/\D/g, '');
    if (!cpf || cpf.length !== 11 || !cpfValido(cpf)) return { exists: false };

    const rows = await this.prisma.$queryRaw<{ check_cpf_exists: boolean }[]>`
      SELECT check_cpf_exists(${cpf})
    `;
    return { exists: rows[0]?.check_cpf_exists === true };
  }

  @Get('check-cnpj')
  async checkCnpj(
    @Req() req: Request,
    @Query('cnpj') cnpjParam?: string,
    @Query('exclude_org') excludeOrg?: string,
  ) {
    if (!rateLimitLocal(getIp(req), 'check-cnpj', 5, 60_000)) tooManyRequests();

    const cnpj = cnpjParam?.replace(/\D/g, '');
    if (!cnpj || cnpj.length !== 14) return { exists: false };

    const count = await this.prisma.organization.count({
      where: { cnpj, ...(excludeOrg ? { id: { not: excludeOrg } } : {}) },
    });
    return { exists: count > 0 };
  }

  @Get('check-phone')
  async checkPhone(@Req() req: Request, @Query('phone') phoneParam?: string) {
    if (!rateLimitLocal(getIp(req), 'check-phone', 5, 60_000)) tooManyRequests();

    const phone = phoneParam?.replace(/\D/g, '');
    if (!phone || phone.length < 10 || phone.length > 11) return { exists: false };

    const profile = await this.prisma.profile.findFirst({ where: { phone }, select: { id: true } });
    return { exists: profile !== null };
  }
}
