import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { MinhaAreaService } from './minha-area.service';

@UseGuards(SupabaseJwtGuard)
@Controller('minha-area')
export class MinhaAreaController {
  constructor(private readonly minhaArea: MinhaAreaService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.minhaArea.getDashboard(user.id);
  }

  @Get('eventos-publicados')
  eventosPublicados(@CurrentUser() user: AuthenticatedUser) {
    return this.minhaArea.getEventosPublicados(user.id);
  }
}
