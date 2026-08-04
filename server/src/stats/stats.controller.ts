import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

interface StatsPublicas {
  ativos: number;
  realizados: number;
  usuarios: number;
}

@Controller('stats')
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@Res({ passthrough: true }) res: Response) {
    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    try {
      // stats_publicas() retorna um único valor composto/JSON — a coluna
      // vem com o nome da própria função, não uma tabela de colunas.
      const rows = await this.prisma.$queryRaw<{ stats_publicas: StatsPublicas }[]>`SELECT stats_publicas()`;
      return rows[0]?.stats_publicas ?? { ativos: 0, realizados: 0, usuarios: 0 };
    } catch {
      return { ativos: 0, realizados: 0, usuarios: 0 };
    }
  }
}
