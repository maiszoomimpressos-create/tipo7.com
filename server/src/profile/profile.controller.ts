import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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

  // GET /profile/veiculo/:placa — pré-preenche o formulário quando o carro
  // já está cadastrado na Autosave (busca ao sair do campo Placa, mesmo
  // padrão de handleBlurCpf em ProfileForm.tsx).
  @Get('veiculo/:placa')
  buscarVeiculo(@Param('placa') placa: string) {
    if (!placa?.trim()) throw new BadRequestException('Placa não informada');
    return this.profile.buscarVeiculo(placa.trim());
  }
}
