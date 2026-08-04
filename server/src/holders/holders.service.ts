import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Porte 1:1 de web/src/app/api/holders/route.ts.
@Injectable()
export class HoldersService {
  constructor(private readonly prisma: PrismaService) {}

  async salvar(
    userId: string,
    body: { order_item_id?: string; slot_number?: number; full_name?: string; cpf?: string; email?: string; birth_date?: string },
  ) {
    const { order_item_id, slot_number, full_name, cpf, email, birth_date } = body;

    if (!order_item_id || slot_number == null || !full_name || !cpf || !email || !birth_date) {
      throw new BadRequestException('Campos obrigatórios ausentes');
    }
    if (typeof email !== 'string' || !email.includes('@') || email.length > 254) {
      throw new BadRequestException('Email inválido');
    }

    const item = await this.prisma.orderItem.findUnique({
      where: { id: order_item_id },
      select: { id: true, order: { select: { userId: true } } },
    });
    if (!item || item.order.userId !== userId) throw new ForbiddenException('Acesso negado');

    await this.prisma.ticketHolder.upsert({
      where: { orderItemId_slotNumber: { orderItemId: order_item_id, slotNumber: slot_number } },
      create: { orderItemId: order_item_id, slotNumber: slot_number, fullName: full_name, cpf, email, birthDate: new Date(birth_date) },
      update: { fullName: full_name, cpf, email, birthDate: new Date(birth_date) },
    });

    return { ok: true };
  }
}
