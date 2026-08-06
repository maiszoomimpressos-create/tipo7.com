import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { OrganizationsService } from './organizations.service';

@UseGuards(SupabaseJwtGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  listMinhas(@CurrentUser() user: AuthenticatedUser) {
    return this.organizations.listMinhas(user.id);
  }

  @Post()
  criar(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.organizations.criar(user.id, body);
  }

  @Get('pedidos-pendentes')
  pedidosPendentes(@CurrentUser() user: AuthenticatedUser) {
    return this.organizations.pedidosPendentes(user.id);
  }

  @Get('socios-ativos')
  sociosAtivos(@CurrentUser() user: AuthenticatedUser) {
    return this.organizations.sociosAtivos(user.id);
  }

  @Get('colaboradores')
  colaboradores(@CurrentUser() user: AuthenticatedUser) {
    return this.organizations.colaboradores(user.id);
  }

  @Put(':id')
  atualizar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    return this.organizations.atualizar(user.id, id, body);
  }

  // Só o nicho — ao contrário do PUT acima, nunca mexe em
  // name/cnpj/nomeFantasia/etc. Usado pelo modal de criação de evento, que
  // não deve sobrescrever dados da organização já existente.
  @Patch(':id/nicho')
  atualizarNicho(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { nicho?: 'eventos' | 'estacionamento' | 'ambos' },
  ) {
    return this.organizations.atualizarNicho(user.id, id, body?.nicho);
  }

  @Get(':id/socios')
  listSocios(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.organizations.listSocios(user.id, id);
  }

  @Post(':id/socios')
  convidarSocio(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    return this.organizations.convidarSocio(user.id, id, body);
  }

  @Post(':id/socios/responder')
  responderConvite(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: { aceitar?: boolean }) {
    return this.organizations.responderConvite(user.id, id, !!body?.aceitar);
  }
}
