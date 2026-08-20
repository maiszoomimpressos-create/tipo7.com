import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_COST = 10;

function isUniqueConstraintError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

// Porte 1:1 de web/src/app/api/trabalhos/{,responder}/route.ts.
// Token+PIN (19/08/2026, design combinado — ver project_token_pin_acesso_caixa
// na memória) adicionado por cima: base pra abrir caixa sem precisar de login
// completo (PC compartilhado, maquininha). A rota pública que CONSOME
// token+PIN (login alternativo) ainda não existe — só o que gera e guarda.
@Injectable()
export class TrabalhosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(userId: string) {
    const staff = await this.prisma.eventStaff.findMany({
      where: { userId, status: { in: ['pending', 'active'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        token: true,
        pinHash: true,
        event: { select: { id: true, title: true, dateStart: true, venueName: true, city: true, state: true, bannerUrl: true } },
        eventPosition: {
          select: { id: true, name: true, eventPositionPermissions: { select: { permission: true } } },
        },
        profile: { select: { fullName: true } },
      },
    });

    return {
      staff: staff.map((s) => ({
        id: s.id,
        status: s.status,
        created_at: s.createdAt,
        // TrabalhosClient.tsx espera snake_case (mesmo shape que o Supabase
        // devolvia antes) — Prisma devolve camelCase, remapeia explícito
        // (mesma lição já aplicada em carrossel/criar-filho na Fase 5).
        events: s.event
          ? {
              id: s.event.id,
              title: s.event.title,
              date_start: s.event.dateStart,
              venue_name: s.event.venueName,
              city: s.event.city,
              state: s.event.state,
              banner_url: s.event.bannerUrl,
            }
          : null,
        event_positions: s.eventPosition
          ? { id: s.eventPosition.id, name: s.eventPosition.name, event_position_permissions: s.eventPosition.eventPositionPermissions }
          : null,
        convidado_por: s.profile,
        // token em si (nunca o PIN, esse só existe como hash) — reaproveitado
        // toda vez que o usuário reabrir /trabalho, não é "mostra uma vez só".
        token: s.token,
        pin_definido: !!s.pinHash,
      })),
    };
  }

  // Código numérico curto, fácil de digitar em teclado físico de maquininha
  // (achado da pesquisa de hardware: SmartPOS tem teclado, mas numérico é
  // sempre mais rápido que alfanumérico). 8 dígitos — espaço grande o
  // suficiente pra não colidir na prática, mas resolve colisão real via
  // retry no unique constraint em vez de checar antes (mesma lição do
  // register()/login Google em auth-core.service.ts: pre-check sozinho é
  // TOCTOU).
  private gerarTokenNumerico(): string {
    return String(randomInt(0, 100_000_000)).padStart(8, '0');
  }

  async responder(userId: string, staffId: string | undefined, acao: string | undefined) {
    if (!staffId || !acao || !['aceitar', 'recusar'].includes(acao)) {
      throw new BadRequestException('Dados inválidos');
    }

    const registro = await this.prisma.eventStaff.findFirst({
      where: { id: staffId, userId, status: 'pending' },
      select: { id: true },
    });
    if (!registro) throw new NotFoundException('Convite não encontrado ou já respondido');

    if (acao === 'recusar') {
      await this.prisma.eventStaff.update({ where: { id: staffId }, data: { status: 'rejected' } });
      return { ok: true, status: 'rejected' };
    }

    // Aceitar já gera o token de acesso a caixa (pedido do usuário: "quando
    // ele aceita o serviço... o caixa já foi criado e o usuário aceitou
    // trabalhar naquele caixa" — esse é o gancho certo, é o momento em que
    // o sistema sabe com certeza que essa pessoa vai operar esse evento).
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      try {
        const atualizado = await this.prisma.eventStaff.update({
          where: { id: staffId },
          data: { status: 'active', token: this.gerarTokenNumerico() },
          select: { token: true },
        });
        return { ok: true, status: 'active', token: atualizado.token };
      } catch (err) {
        if (isUniqueConstraintError(err) && tentativa < 4) continue;
        throw err;
      }
    }
    throw new BadRequestException('Não foi possível gerar o token de acesso — tente novamente.');
  }

  // Usuário cria (ou recria) o PIN daquele evento específico — por evento,
  // não pessoal fixo (decisão explícita do usuário, 19/08/2026). Só o dono
  // do registro, só depois de aceito (token já existe).
  async definirPin(userId: string, staffId: string | undefined, pin: string | undefined) {
    if (!staffId || !pin) throw new BadRequestException('Dados inválidos');
    if (!/^\d{4}$|^\d{6}$/.test(pin)) throw new BadRequestException('PIN deve ter 4 ou 6 dígitos numéricos');

    const registro = await this.prisma.eventStaff.findFirst({
      where: { id: staffId, userId, status: 'active' },
      select: { id: true, token: true },
    });
    if (!registro) throw new NotFoundException('Registro não encontrado');
    if (!registro.token) throw new BadRequestException('Aceite o convite antes de criar o PIN');

    const pinHash = await bcrypt.hash(pin, BCRYPT_COST);
    await this.prisma.eventStaff.update({
      where: { id: staffId },
      data: { pinHash, pinTentativas: 0, pinBloqueadoAte: null },
    });
    return { ok: true };
  }
}
