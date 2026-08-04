import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface EventoVendavel {
  id: string;
  title: string;
}

// Porte 1:1 de web/src/lib/eventFamily.ts. Nesting é de no máximo 1 nível
// (um filho não pode ter filhos), então não precisa de busca recursiva.
@Injectable()
export class EventFamilyService {
  constructor(private readonly prisma: PrismaService) {}

  async getEventosVendaveisNoCaixa(eventoIdDoCaixa: string): Promise<EventoVendavel[]> {
    const evento = await this.prisma.event.findUnique({
      where: { id: eventoIdDoCaixa },
      select: { id: true, title: true, parentEventId: true },
    });
    if (!evento) return [{ id: eventoIdDoCaixa, title: 'Evento' }];

    if (evento.parentEventId) {
      return [{ id: evento.id, title: evento.title ?? 'Evento' }];
    }

    const filhos = await this.prisma.event.findMany({
      where: { parentEventId: eventoIdDoCaixa, permitirVendaNoCaixaPai: true },
      select: { id: true, title: true },
    });

    return [
      { id: evento.id, title: evento.title ?? 'Evento' },
      ...filhos.map((f) => ({ id: f.id, title: f.title ?? 'Evento' })),
    ];
  }

  // Raiz da "família" de um evento — o próprio id se for pai, ou o id do pai
  // se for filho. Usado pra comparar se dois caixas pertencem à mesma família.
  async getFamiliaRoot(eventoId: string): Promise<string> {
    const evento = await this.prisma.event.findUnique({ where: { id: eventoId }, select: { parentEventId: true } });
    return evento?.parentEventId ?? eventoId;
  }
}
