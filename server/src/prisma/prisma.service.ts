import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

// PrismaClient (Prisma 7) usa driver adapter (@prisma/adapter-pg, sobre o
// pacote `pg` puro JS) em vez do engine nativo — necessário nesta máquina
// porque o binário nativo do Prisma é bloqueado por política WDAC do Windows,
// mas também é a forma recomendada pra produção (sem processo de engine
// separado).
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Conectado ao Postgres via Prisma (driver adapter pg)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
