import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PedidoAtomicoItem {
  ticket_id: string;
  quantity: number;
  unit_price: number;
}

export interface PedidoAtomicoResultado {
  order_id?: string;
  error?: string;
  ticket_id?: string;
  disponivel?: number;
}

// Wrapper compartilhado pra função SQL SECURITY DEFINER criar_pedido_atomico
// (lock FOR UPDATE, previne overselling por race condition) — usada pela
// bilheteria presencial (Fase 3) e pelo checkout online (Fase 4). Não
// reescrever a lógica de lock em TS, só chamar a função como está.
@Injectable()
export class PedidoAtomicoService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(userId: string, eventId: string, items: PedidoAtomicoItem[]): Promise<PedidoAtomicoResultado> {
    const rows = await this.prisma.$queryRaw<{ criar_pedido_atomico: PedidoAtomicoResultado | null }[]>`
      SELECT criar_pedido_atomico(${userId}::uuid, ${eventId}::uuid, ${JSON.stringify(items)}::jsonb)
    `;
    return rows[0]?.criar_pedido_atomico ?? {};
  }
}
