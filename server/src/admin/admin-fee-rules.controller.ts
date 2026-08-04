import { BadRequestException, Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { AdminService } from './admin.service';

@UseGuards(SupabaseJwtGuard)
@Controller('admin/fee-rules')
export class AdminFeeRulesController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.listFeeRules(user.id);
  }

  @Post()
  criar(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, any>) {
    return this.admin.criarFeeRule(user.id, body);
  }

  @Delete()
  remover(@CurrentUser() user: AuthenticatedUser, @Query('id') id?: string) {
    if (!id) throw new BadRequestException('id obrigatório');
    return this.admin.removerFeeRule(user.id, id);
  }
}
