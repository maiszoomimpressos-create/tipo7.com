import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { AdminService } from './admin.service';

@UseGuards(SupabaseJwtGuard)
@Controller('admin')
export class AdminTeamController {
  constructor(private readonly admin: AdminService) {}

  // Listagens (Fase 7.2, G4) — reúne junto com o resto de "coisas
  // administrativas gerais" já neste controller (equipe/promotores).
  @Get('equipe')
  listarEquipe(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.listarEquipe(user.id);
  }

  @Get('estabelecimentos')
  listarEstabelecimentos(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.listarEstabelecimentos(user.id);
  }

  @Get('promotores')
  listarPromotores(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.listarPromotores(user.id);
  }

  @Get('eventos')
  listarEventos(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.listarEventosAdmin(user.id);
  }

  @Post('equipe')
  criar(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.admin.criarMembroEquipe(user.id, body);
  }

  @Delete('equipe')
  remover(@CurrentUser() user: AuthenticatedUser, @Query('memberId') memberId?: string) {
    if (!memberId) throw new BadRequestException('memberId obrigatório');
    return this.admin.removerMembroEquipe(user.id, memberId);
  }

  @Patch('promotores/:userId')
  atualizarFeePct(@CurrentUser() user: AuthenticatedUser, @Param('userId') userId: string, @Body() body: { fee_pct?: number }) {
    return this.admin.atualizarFeePctPromotor(user.id, userId, body.fee_pct as number);
  }
}
