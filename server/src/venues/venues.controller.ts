import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { VenuesService } from './venues.service';

@UseGuards(SupabaseJwtGuard)
@Controller('venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Post(':id/tornar-responsavel')
  tornarResponsavel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    return this.venues.tornarResponsavel(user.id, id, body ?? {});
  }
}
