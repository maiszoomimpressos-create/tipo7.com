import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { EstacionamentoService } from './estacionamento.service';

@UseGuards(SupabaseJwtGuard)
@Controller()
export class EstacionamentoController {
  constructor(private readonly estacionamento: EstacionamentoService) {}

  // ── CRUD de estacionamentos (dono do evento) ─────────────────────────────

  @Get('eventos/:id/estacionamentos')
  listEstacionamentos(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.estacionamento.listEstacionamentos(user.id, id);
  }

  @Post('eventos/:id/estacionamentos')
  criarEstacionamento(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    return this.estacionamento.criarEstacionamento(user.id, id, body);
  }

  @Patch('eventos/:id/estacionamentos/:estacionamentoId')
  atualizarEstacionamento(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('estacionamentoId') estacionamentoId: string,
    @Body() body: any,
  ) {
    return this.estacionamento.atualizarEstacionamento(user.id, id, estacionamentoId, body);
  }

  @Delete('eventos/:id/estacionamentos/:estacionamentoId')
  removerEstacionamento(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('estacionamentoId') estacionamentoId: string,
  ) {
    return this.estacionamento.removerEstacionamento(user.id, id, estacionamentoId);
  }

  // ── Portões ───────────────────────────────────────────────────────────────

  @Post('eventos/:id/estacionamentos/:estacionamentoId/portoes')
  criarPortao(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('estacionamentoId') estacionamentoId: string,
    @Body() body: { nome?: string; tipo?: string },
  ) {
    return this.estacionamento.criarPortao(user.id, id, estacionamentoId, body);
  }

  @Patch('eventos/:id/estacionamentos/:estacionamentoId/portoes/:portaoId')
  atualizarPortao(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('estacionamentoId') estacionamentoId: string,
    @Param('portaoId') portaoId: string,
    @Body() body: { nome?: string; tipo?: string; ativo?: boolean },
  ) {
    return this.estacionamento.atualizarPortao(user.id, id, estacionamentoId, portaoId, body);
  }

  @Delete('eventos/:id/estacionamentos/:estacionamentoId/portoes/:portaoId')
  removerPortao(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('estacionamentoId') estacionamentoId: string,
    @Param('portaoId') portaoId: string,
  ) {
    return this.estacionamento.removerPortao(user.id, id, estacionamentoId, portaoId);
  }

  // ── Operação (entrada/saída/sessões) ─────────────────────────────────────

  @Post('estacionamento/entrada')
  entrada(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.estacionamento.entrada(user.id, body);
  }

  @Post('estacionamento/saida')
  saida(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.estacionamento.saida(user.id, body);
  }

  @Get('estacionamento/placa-lookup')
  placaLookup(@Query('placa') placa?: string) {
    if (!placa?.trim()) throw new BadRequestException('Placa não informada');
    return this.estacionamento.placaLookup(placa.trim());
  }

  @Get('estacionamento/:eventoId/sessoes')
  listSessoes(@CurrentUser() user: AuthenticatedUser, @Param('eventoId') eventoId: string, @Query('status') status?: string) {
    return this.estacionamento.listSessoes(user.id, eventoId, status ?? 'aberto');
  }

  @Post('estacionamento/:eventoId/abrir-caixa')
  abrirCaixa(@CurrentUser() user: AuthenticatedUser, @Param('eventoId') eventoId: string, @Body() body: any) {
    return this.estacionamento.abrirCaixa(user.id, eventoId, body);
  }
}
