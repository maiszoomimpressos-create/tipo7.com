import { BadRequestException, Body, Controller, Delete, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { AdminService } from './admin.service';

@UseGuards(SupabaseJwtGuard)
@Controller('admin')
export class AdminTeamController {
  constructor(private readonly admin: AdminService) {}

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
