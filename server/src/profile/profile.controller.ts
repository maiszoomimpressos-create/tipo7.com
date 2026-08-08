import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { ProfileService } from './profile.service';

@UseGuards(SupabaseJwtGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profile.getProfile(user.id);
  }

  @Patch()
  atualizarProfile(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.profile.atualizarProfile(user.id, body);
  }

  // POST /profile/veiculo — aba "Veículo" em /perfil. Não salva nada local
  // (sem tabela própria) — só repassa pra Autosave, que é a fonte única de
  // verdade dos veículos por enquanto (decisão do usuário, 08/08/2026).
  @Post('veiculo')
  salvarVeiculo(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.profile.salvarVeiculo(user.id, body);
  }
}
