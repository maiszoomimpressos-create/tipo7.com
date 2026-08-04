import { BadRequestException, Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { AdminService } from './admin.service';

@UseGuards(SupabaseJwtGuard)
@Controller('admin/saldo-bilheteria')
export class AdminSaldoBilheteriaController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.listSaldoBilheteria(user.id);
  }

  @Patch()
  patch(@CurrentUser() user: AuthenticatedUser, @Body() body: { event_id?: string; bloqueio_ativo?: boolean }) {
    return this.admin.patchSaldoBilheteria(user.id, body.event_id as string, body.bloqueio_ativo as boolean);
  }

  @Get('movimentos')
  movimentos(@CurrentUser() user: AuthenticatedUser, @Query('event_id') eventId?: string) {
    if (!eventId) throw new BadRequestException('event_id obrigatório');
    return this.admin.listMovimentosSaldoBilheteria(user.id, eventId);
  }
}
