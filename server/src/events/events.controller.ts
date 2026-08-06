import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { getIp, rateLimitLocal, tooManyRequests } from '../common/rate-limit.util';
import { EventosAdminService } from '../eventos/eventos-admin.service';
import { EventsService } from './events.service';

@Controller('eventos')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly eventosAdmin: EventosAdminService,
  ) {}

  @Get('buscar')
  async buscar(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query('q') q?: string,
    @Query('categoria') categoria?: string,
    @Query('cidade') cidade?: string,
    @Query('limit') limitParam?: string,
  ) {
    if (!rateLimitLocal(getIp(req), 'eventos-buscar', 20, 60_000)) tooManyRequests();

    const limit = Math.min(parseInt(limitParam ?? '12', 10) || 12, 48);
    res.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    return this.events.buscar({
      q: q?.trim() ?? '',
      categoria: categoria ?? '',
      cidade: cidade ?? '',
      limit,
    });
  }

  @Get('destaque')
  async destaque(
    @Res({ passthrough: true }) res: Response,
    @Query('estado') estado?: string,
    @Query('lat') latParam?: string,
    @Query('lng') lngParam?: string,
  ) {
    const lat = latParam ? parseFloat(latParam) : null;
    const lng = lngParam ? parseFloat(lngParam) : null;

    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return this.events.destaque({ estado: estado ?? null, lat, lng });
  }

  // Locais já usados pelo promotor em outros eventos — precisa vir ANTES de
  // ':id' abaixo (rota estática, senão ':id' capturaria "locais-recentes"
  // como se fosse um id de evento).
  @UseGuards(SupabaseJwtGuard)
  @Get('locais-recentes')
  locaisRecentes(@CurrentUser() user: AuthenticatedUser, @Query('excluirId') excluirId?: string) {
    return this.eventosAdmin.getLocaisRecentes(user.id, excluirId);
  }

  @UseGuards(SupabaseJwtGuard)
  @Post()
  criarEvento(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.eventosAdmin.criarEvento(user.id, body);
  }

  // Leitura pública do "core" do evento — mesma info que a página pública e
  // o formulário do organizador já buscavam sem guarda de auth.
  @Get(':id')
  getEventoCore(@Param('id') id: string) {
    return this.eventosAdmin.getEventoCore(id);
  }

  // Leitura pública de dias/ingressos/atributos — mesma info que a página
  // do evento (e o editor do organizador) já buscava sem guarda de auth.
  @Get(':id/dias')
  getDias(@Param('id') id: string) {
    return this.eventosAdmin.getDias(id);
  }

  @Get(':id/atributos')
  getAtributos(@Param('id') id: string) {
    return this.eventosAdmin.getAtributosEvento(id);
  }
}
