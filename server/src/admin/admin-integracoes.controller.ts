import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { AdminService } from './admin.service';

@UseGuards(SupabaseJwtGuard)
@Controller('admin/integracoes')
export class AdminIntegracoesController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.listIntegracoes(user.id);
  }

  @Put(':id')
  atualizar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    return this.admin.atualizarIntegracao(user.id, id, body);
  }

  @Put('rotas/:id')
  atualizarRota(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    return this.admin.atualizarIntegracaoRota(user.id, id, body);
  }
}
