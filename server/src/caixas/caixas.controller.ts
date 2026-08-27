import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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

  // Precisa vir ANTES de 'caixas/:caixaId' abaixo — rota literal tem que
  // ser registrada primeiro, senão o Express casa ':caixaId' = "meus-abertos"
  // e nunca chega aqui (achado real testando).
  @Get('caixas/meus-abertos')
  meusCaixasAbertos(@CurrentUser() user: AuthenticatedUser) {
    return this.caixas.getMeusCaixasAbertos(user.id);
  }

  @Get('caixas/:caixaId')
  getCaixa(@CurrentUser() user: AuthenticatedUser, @Param('caixaId') caixaId: string) {
    return this.caixas.getCaixa(user.id, caixaId);
  }

  @Patch('caixas/:caixaId')
  atualizar(@CurrentUser() user: AuthenticatedUser, @Param('caixaId') caixaId: string, @Body() body: { nome?: string; fundo_inicial?: number }) {
    return this.caixas.atualizar(user.id, caixaId, body);
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

  @Post('caixas/sangria')
  sangrar(@CurrentUser() user: AuthenticatedUser, @Body() body: { caixaId?: string; valor?: number; motivo?: string; codigo?: string }) {
    return this.caixas.sangrar(user.id, body);
  }

  @Delete('caixas/:caixaId')
  excluir(@CurrentUser() user: AuthenticatedUser, @Param('caixaId') caixaId: string) {
    return this.caixas.excluir(user.id, caixaId);
  }

  // ==== Locais de bilheteria (pedido do usuário, 27/08/2026) ====

  @Get('eventos/:id/bilheterias')
  listBilheterias(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.caixas.listBilheterias(user.id, id);
  }

  @Post('eventos/:id/bilheterias')
  criarBilheteria(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: { nome?: string }) {
    return this.caixas.criarBilheteria(user.id, id, body);
  }

  @Patch('eventos/:id/bilheterias/:bilheteriaId')
  atualizarBilheteria(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('bilheteriaId') bilheteriaId: string,
    @Body() body: { nome?: string; ativo?: boolean },
  ) {
    return this.caixas.atualizarBilheteria(user.id, id, bilheteriaId, body);
  }

  @Delete('eventos/:id/bilheterias/:bilheteriaId')
  removerBilheteria(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('bilheteriaId') bilheteriaId: string) {
    return this.caixas.removerBilheteria(user.id, id, bilheteriaId);
  }
}
