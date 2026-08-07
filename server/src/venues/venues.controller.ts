import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { VenuesService } from './venues.service';

@UseGuards(SupabaseJwtGuard)
@Controller('venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  // Porte de hooks/useCodigos.ts (Fase 7.2, G6) — precisa vir ANTES de
  // ':id/tornar-responsavel' abaixo (rota estática, senão ':id' captura
  // "minhas" como se fosse um id de venue). Como os dois métodos são GET
  // vs POST em paths diferentes não há conflito real de match, mas a ordem
  // é mantida por clareza/consistência com o resto do projeto.
  @Get('minhas')
  minhas(@CurrentUser() user: AuthenticatedUser) {
    return this.venues.listarMinhas(user.id);
  }

  // Porte de EventoForm.tsx (Fase 7.2-b) — upsert por google_place_id.
  @Post()
  upsertGoogle(@Body() body: any) {
    return this.venues.upsertPorGooglePlaceId(body ?? {});
  }

  @Post(':id/tornar-responsavel')
  tornarResponsavel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    return this.venues.tornarResponsavel(user.id, id, body ?? {});
  }
}
