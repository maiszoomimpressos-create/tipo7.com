import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { apenasDigitos } from '../common/document-validation.util';
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
      select: {
        id: true, order: { select: { userId: true } },
        ticketHolders: { where: { slotNumber: slot_number }, select: { userId: true } },
      },
    });
    if (!item || item.order.userId !== userId) throw new ForbiddenException('Acesso negado');

    // Trava de verdade no backend (não só esconder o botão no front): uma
    // vez que o portador virou conta de OUTRA pessoa (via link ou preenchido
    // manual com CPF de terceiro), quem comprou não pode mais sobrescrever.
    const holderAtual = item.ticketHolders[0];
    if (holderAtual?.userId && holderAtual.userId !== userId) {
      throw new ConflictException('Esse portador já foi preenchido pela própria pessoa — não é possível editar.');
    }

    const cpfLimpo = apenasDigitos(cpf);

    // Pedido do usuário (09/08/2026): se o CPF bate com uma conta Tipo7 já
    // existente, o ingresso "passa a ser" dessa pessoa — aparece na Meus
    // Ingressos dela também, e o comprador não pode mais editar esse
    // portador depois (só reenviar/imprimir). Ver holder-links.service.ts
    // pro mesmo comportamento no fluxo de link/reivindicação.
    const contaExistente = await this.prisma.profile.findUnique({ where: { cpf: cpfLimpo }, select: { id: true } });

    await this.prisma.ticketHolder.upsert({
      where: { orderItemId_slotNumber: { orderItemId: order_item_id, slotNumber: slot_number } },
      create: { orderItemId: order_item_id, slotNumber: slot_number, fullName: full_name, cpf: cpfLimpo, email, birthDate: new Date(birth_date), userId: contaExistente?.id },
      update: { fullName: full_name, cpf: cpfLimpo, email, birthDate: new Date(birth_date), userId: contaExistente?.id },
    });

    return { ok: true };
  }
}
