import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

// Porte de web/src/app/admin/funcoes/{page,FuncoesClient}.tsx (Fase 7.2, G5)
// — CRUD completo (ativos+inativos), diferente do StaffFunctionTemplatesController
// (só GET público, filtrado, pra montar a equipe de um evento). Guard super_admin
// porque a página já checava `me.role !== 'super_admin'`.
@UseGuards(SupabaseJwtGuard)
@Controller('admin/funcoes')
export class AdminFuncoesController {
  constructor(
    private readonly admin: AdminService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    await this.admin.requireSuperAdmin(user.id);
    const funcoes = await this.prisma.staffFunctionTemplate.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true, name: true, active: true, sortOrder: true,
        staffFunctionTemplatePermissions: { select: { permission: true } },
      },
    });
    return funcoes.map((f) => ({
      id: f.id,
      name: f.name,
      active: f.active,
      sort_order: f.sortOrder,
      staff_function_template_permissions: f.staffFunctionTemplatePermissions,
    }));
  }

  @Post()
  async criar(@CurrentUser() user: AuthenticatedUser, @Body() body: { nome?: string; permissoes?: string[] }) {
    await this.admin.requireSuperAdmin(user.id);
    if (!body.nome?.trim()) throw new BadRequestException('Nome é obrigatório');

    const max = await this.prisma.staffFunctionTemplate.aggregate({ _max: { sortOrder: true } });
    const funcao = await this.prisma.staffFunctionTemplate.create({
      data: { name: body.nome.trim(), sortOrder: (max._max.sortOrder ?? -1) + 1 },
      select: { id: true },
    });

    if (body.permissoes?.length) {
      await this.prisma.staffFunctionTemplatePermission.createMany({
        data: body.permissoes.map((p) => ({ templateId: funcao.id, permission: p as never })),
      });
    }

    return { ok: true, id: funcao.id };
  }

  @Patch(':id')
  async atualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { nome?: string; active?: boolean; sortOrder?: number; permissoes?: string[] },
  ) {
    await this.admin.requireSuperAdmin(user.id);

    await this.prisma.staffFunctionTemplate.update({
      where: { id },
      data: {
        ...(body.nome?.trim() ? { name: body.nome.trim() } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    });

    if (body.permissoes !== undefined) {
      await this.prisma.staffFunctionTemplatePermission.deleteMany({ where: { templateId: id } });
      if (body.permissoes.length > 0) {
        await this.prisma.staffFunctionTemplatePermission.createMany({
          data: body.permissoes.map((p) => ({ templateId: id, permission: p as never })),
        });
      }
    }

    return { ok: true };
  }

  @Delete(':id')
  async remover(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.admin.requireSuperAdmin(user.id);
    // Cascade de staff_function_template_permissions já existe no schema
    // (onDelete: Cascade na FK templateId) — apagar o template basta.
    await this.prisma.staffFunctionTemplate.delete({ where: { id } });
    return { ok: true };
  }
}
