import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { IngressosService } from './ingressos.service';

@UseGuards(SupabaseJwtGuard)
@Controller('ingressos')
export class IngressosController {
  constructor(private readonly ingressos: IngressosService) {}

  @Patch(':id')
  atualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { name?: string; price?: number; quantity?: number },
  ) {
    return this.ingressos.atualizar(user.id, id, body);
  }
}
