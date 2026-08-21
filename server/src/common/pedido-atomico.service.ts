import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PedidoAtomicoItem {
  ticket_id: string;
  quantity: number;
  unit_price: number;
}

// Uma linha do carrinho pode virar MAIS de um item aqui (21/08/2026) — se o
// ingresso tem lote e a quantidade pedida cruza a fronteira de um lote, a
// função SQL devolve um item por lote cruzado, cada um com o preço real
// calculado dentro do lock. lote_id/lote_ordem só vêm preenchidos nesse caso;
// ingresso sem lote continua devolvendo exatamente 1 item, preço confiado do
// TS, igual sempre foi.
export interface PedidoAtomicoResultadoItem {
  ticket_id:  string;
  quantity:   number;
  unit_price: number;
  lote_id?:    string | null;
  lote_ordem?: number | null;
}

export interface PedidoAtomicoResultado {
  order_id?: string;
  error?: string;
  ticket_id?: string;
  disponivel?: number;
  // Total de verdade da compra, calculado dentro do lock — é o valor que
  // deve ser usado pra cobrar no gateway de pagamento, nunca o total
  // pré-calculado no TS antes de chamar essa função (esse é só uma
  // estimativa, pode ficar errado se a compra cruzar lote).
  total?: number;
  items?: PedidoAtomicoResultadoItem[];
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
