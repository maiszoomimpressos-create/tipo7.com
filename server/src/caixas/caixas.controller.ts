import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { CaixasService } from './caixas.service';

@UseGuards(SupabaseJwtGuard)
@Controller()
export class CaixasController {
  constructor(private readonly caixas: CaixasService) {}

  @Get('eventos/:id/caixas')
  listPorEvento(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.caixas.listPorEvento(user.id, id);
  }

  @Get('caixas/:caixaId')
  getCaixa(@CurrentUser() user: AuthenticatedUser, @Param('caixaId') caixaId: string) {
    return this.caixas.getCaixa(user.id, caixaId);
  }

  // Fase 7.2, G7 — bootstrap da tela de venda (permissão mais ampla que
  // getCaixa acima, ver comentário no service).
  @Get('caixas/:caixaId/bootstrap')
  getCaixaParaOperador(@CurrentUser() user: AuthenticatedUser, @Param('caixaId') caixaId: string) {
    return this.caixas.getCaixaParaOperador(user.id, caixaId);
  }

  @Get('eventos/:id/meu-caixa')
  meuCaixaAberto(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.caixas.getMeuCaixaAberto(user.id, id);
  }

  @Post('caixas/abrir')
  abrir(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.caixas.abrir(user.id, body);
  }

  @Post('caixas/pausar')
  pausar(@CurrentUser() user: AuthenticatedUser, @Body() body: { eventoId: string; pausar: boolean }) {
    return this.caixas.pausar(user.id, body);
  }

  @Post('caixas/transferir')
  transferir(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.caixas.transferir(user.id, body);
  }

  @Post('caixas/fechar')
  fechar(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.caixas.fechar(user.id, body);
  }

  @Post('caixas/validar')
  validar(@CurrentUser() user: AuthenticatedUser, @Body() body: { caixaId: string }) {
    return this.caixas.validar(user.id, body);
  }
}
