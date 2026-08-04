import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type Gateway = 'mercadopago' | 'pagbank';

export interface GatewayInfo {
  gateway: Gateway;
  ownerId: string | null;
}

// Porte 1:1 de web/src/lib/resolveGateway.ts.
@Injectable()
export class GatewayResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveEventGateway(eventoId: string): Promise<GatewayInfo> {
    const evento = await this.prisma.event.findUnique({
      where: { id: eventoId },
      select: { paymentGateway: true, organization: { select: { ownerId: true } } },
    });

    return {
      gateway: (evento?.paymentGateway as Gateway | undefined) ?? 'mercadopago',
      ownerId: evento?.organization?.ownerId ?? null,
    };
  }
}
