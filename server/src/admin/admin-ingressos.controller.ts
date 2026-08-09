import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { AdminIngressosService } from './admin-ingressos.service';

// Pedido do usuário (09/08/2026) — ferramenta de suporte pra achar rápido
// os dados de um ingresso (comprador, evento, portador) sem precisar de
// consulta SQL direto no banco toda vez. Fica em Admin > Players > Ingressos.
@UseGuards(SupabaseJwtGuard)
@Controller('admin/ingressos')
export class AdminIngressosController {
  constructor(private readonly admin: AdminIngressosService) {}

  @Get('buscar')
  buscar(@CurrentUser() user: AuthenticatedUser, @Query('q') q?: string) {
    const query = q?.trim();
    if (!query) throw new BadRequestException('Parâmetro q obrigatório');
    return this.admin.buscar(user.id, query);
  }
}
