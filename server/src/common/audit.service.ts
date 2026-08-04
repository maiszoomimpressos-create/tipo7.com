import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface AuditParams {
  userId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

// Porte 1:1 de web/src/lib/audit.ts — nunca lança exceção, falha silenciosa
// pra não interromper o fluxo principal.
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logAudit(params: AuditParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId ?? null,
          action: params.action,
          resourceType: params.resourceType ?? null,
          resourceId: params.resourceId ?? null,
          details: (params.details as Prisma.InputJsonValue) ?? undefined,
          ip: params.ip ?? null,
        },
      });
    } catch (err) {
      this.logger.error('falha ao registrar audit log', err as Error);
    }
  }
}
