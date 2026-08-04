import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getIp, rateLimitLocal, tooManyRequests } from '../common/rate-limit.util';
import { EventsService } from './events.service';

@Controller('eventos')
export class EventsController {
  constructor(private readonly events: EventsService) {}

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
}
