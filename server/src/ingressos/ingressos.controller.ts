import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { IngressosService } from './ingressos.service';
import { LotesService } from './lotes.service';

@UseGuards(SupabaseJwtGuard)
@Controller('ingressos')
export class IngressosController {
  constructor(
    private readonly ingressos: IngressosService,
    private readonly lotes: LotesService,
  ) {}

  @Patch(':id')
  atualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { name?: string; price?: number; quantity?: number },
  ) {
    return this.ingressos.atualizar(user.id, id, body);
  }

  // ==== lotes (20/08/2026) — ver project_lote_ingressos na memória ====

  @Get(':id/lotes')
  listarLotes(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.lotes.listar(user.id, id);
  }

  @Post(':id/lotes')
  criarLote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { price?: number; quantity?: number; dataCorte?: string | null },
  ) {
    return this.lotes.criar(user.id, id, body);
  }

  @Patch('lotes/:loteId')
  atualizarLote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('loteId') loteId: string,
    @Body() body: { price?: number; quantity?: number; dataCorte?: string | null },
  ) {
    return this.lotes.atualizar(user.id, loteId, body);
  }

  @Delete('lotes/:loteId')
  excluirLote(@CurrentUser() user: AuthenticatedUser, @Param('loteId') loteId: string) {
    return this.lotes.excluir(user.id, loteId);
  }
}
