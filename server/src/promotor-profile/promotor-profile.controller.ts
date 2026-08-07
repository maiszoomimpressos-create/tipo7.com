import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { PromotorProfileService } from './promotor-profile.service';

@UseGuards(SupabaseJwtGuard)
@Controller('profile/promotor')
export class PromotorProfileController {
  constructor(private readonly promotorProfile: PromotorProfileService) {}

  @Get()
  meuPerfil(@CurrentUser() user: AuthenticatedUser) {
    return this.promotorProfile.getMeuPerfil(user.id);
  }

  @Post()
  salvar(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.promotorProfile.salvarMeuPerfil(user.id, body);
  }
}
