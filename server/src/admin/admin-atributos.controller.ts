import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

// Porte de web/src/app/admin/atributos/{page,AtributosClient}.tsx — CRUD das
// definições globais de atributo (event_attributes); os valores por evento
// (event_attribute_values) ficam em EventosAdminController/EventsController.
@UseGuards(SupabaseJwtGuard)
@Controller('admin/atributos')
export class AdminAtributosController {
  constructor(
    private readonly admin: AdminService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    await this.admin.requirePerm(user.id, 'gerenciar_eventos');
    const atributos = await this.prisma.eventAttribute.findMany({
      orderBy: { orderIndex: 'asc' },
      select: { id: true, name: true, icon: true, active: true, orderIndex: true },
    });
    return { atributos: atributos.map((a) => ({ id: a.id, name: a.name, icon: a.icon, active: a.active, order_index: a.orderIndex })) };
  }

  @Post()
  async criar(@CurrentUser() user: AuthenticatedUser, @Body() body: { nome?: string; icone?: string }) {
    await this.admin.requirePerm(user.id, 'gerenciar_eventos');
    if (!body.nome?.trim()) throw new BadRequestException('Nome é obrigatório');

    const max = await this.prisma.eventAttribute.aggregate({ _max: { orderIndex: true } });
    const atributo = await this.prisma.eventAttribute.create({
      data: { name: body.nome.trim(), icon: body.icone || 'Tag', orderIndex: (max._max.orderIndex ?? -1) + 1 },
      select: { id: true },
    });
    return { ok: true, id: atributo.id };
  }

  @Patch(':id')
  async atualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { active?: boolean; orderIndex?: number; nome?: string; icone?: string },
  ) {
    await this.admin.requirePerm(user.id, 'gerenciar_eventos');
    await this.prisma.eventAttribute.update({
      where: { id },
      data: {
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.orderIndex !== undefined ? { orderIndex: body.orderIndex } : {}),
        ...(body.nome ? { name: body.nome.trim() } : {}),
        ...(body.icone ? { icon: body.icone } : {}),
      },
    });
    return { ok: true };
  }

  @Delete(':id')
  async remover(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.admin.requirePerm(user.id, 'gerenciar_eventos');
    await this.prisma.eventAttribute.delete({ where: { id } });
    return { ok: true };
  }
}
