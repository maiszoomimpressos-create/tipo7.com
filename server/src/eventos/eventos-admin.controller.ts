import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { EventosAdminService } from './eventos-admin.service';

@UseGuards(SupabaseJwtGuard)
@Controller('eventos/:id')
export class EventosAdminController {
  constructor(private readonly eventos: EventosAdminService) {}

  @Get('meu-acesso')
  meuAcesso(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.eventos.getMeuAcesso(id, user.id);
  }

  @Get('ingressos-resumo')
  ingressosResumo(@Param('id') id: string) {
    return this.eventos.getIngressosResumo(id);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.eventos.getDashboard(user.id, id);
  }

  @Patch()
  atualizarCore(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    return this.eventos.atualizarCore(user.id, id, body);
  }

  @Delete()
  excluirEvento(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.eventos.excluirEvento(user.id, id);
  }

  @Get('equipe')
  listEquipe(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.eventos.listEquipe(user.id, id);
  }

  @Post('equipe')
  adicionarMembro(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    return this.eventos.adicionarMembro(user.id, id, body);
  }

  @Patch('equipe')
  atualizarMembro(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    return this.eventos.atualizarMembro(user.id, id, body);
  }

  @Delete('equipe')
  removerMembro(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Query('staffId') staffId?: string) {
    if (!staffId) throw new BadRequestException('staffId obrigatório');
    return this.eventos.removerMembro(user.id, id, staffId);
  }

  @Get('funcoes')
  listFuncoes(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.eventos.listFuncoes(user.id, id);
  }

  @Post('funcoes')
  criarFuncao(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    return this.eventos.criarFuncao(user.id, id, body);
  }

  @Patch('funcoes/:funcaoId')
  atualizarFuncao(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('funcaoId') funcaoId: string,
    @Body() body: any,
  ) {
    return this.eventos.atualizarFuncao(user.id, id, funcaoId, body);
  }

  @Delete('funcoes/:funcaoId')
  removerFuncao(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('funcaoId') funcaoId: string) {
    return this.eventos.removerFuncao(user.id, id, funcaoId);
  }

  @Patch('modulos')
  atualizarModulos(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    return this.eventos.atualizarModulos(user.id, id, body);
  }

  @Post('publicar')
  publicar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.eventos.publicar(user.id, id);
  }

  @Get('criar-filho')
  listFilhos(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.eventos.listFilhos(user.id, id);
  }

  @Post('criar-filho')
  criarFilho(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    return this.eventos.criarFilho(user.id, id, body);
  }

  @Post('dias')
  saveDias(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    return this.eventos.saveDias(user.id, id, body);
  }

  @Put('atributos/:attributeId')
  setAtributo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('attributeId') attributeId: string,
    @Body() body: { valueJson?: unknown },
  ) {
    return this.eventos.setAtributoValor(user.id, id, attributeId, body?.valueJson);
  }

  @Delete('atributos/:attributeId')
  removeAtributo(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('attributeId') attributeId: string) {
    return this.eventos.removeAtributoValor(user.id, id, attributeId);
  }
}
