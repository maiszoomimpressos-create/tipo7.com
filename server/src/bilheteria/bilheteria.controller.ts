import { Body, Controller, Get, MessageEvent, Param, Post, Req, Sse, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { BilheteriaService } from './bilheteria.service';
import { BilheteriaStreamService } from './bilheteria-stream.service';

@UseGuards(SupabaseJwtGuard)
@Controller('bilheteria')
export class BilheteriaController {
  constructor(
    private readonly bilheteria: BilheteriaService,
    private readonly stream: BilheteriaStreamService,
  ) {}

  @Post('vender')
  vender(@CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Body() body: any) {
    return this.bilheteria.vender(user.id, req.ip ?? '0.0.0.0', body);
  }

  @Post('holders')
  holders(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.bilheteria.salvarHolders(user.id, body);
  }

  @Post('cancelar-pix')
  cancelarPix(@CurrentUser() user: AuthenticatedUser, @Body() body: { orderId?: string }) {
    return this.bilheteria.cancelarPix(user.id, body);
  }

  @Post('pix')
  criarPix(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.bilheteria.criarPix(user.id, body);
  }

  @Post('pix/confirmar')
  confirmarPix(@CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Body() body: any) {
    return this.bilheteria.confirmarPix(user.id, req.ip ?? '0.0.0.0', body);
  }

  @Get('pix/:orderId')
  statusPix(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.bilheteria.statusPix(user.id, orderId);
  }

  // Fase 7.3 — substitui o canal Realtime (`.channel('bilheteria-:eventoId').send()`)
  // que o BilheteiroClient usava pra avisar a Segunda Tela. Sem checagem extra
  // de permissão no caixa: o guard de login já é estritamente mais forte do
  // que o esquema anterior (canal aberto pra quem tivesse a anon key pública).
  // Escopado por CAIXA desde 09/08/2026 (era por evento — ver bilheteria-stream.service.ts).
  @Post('caixa/:caixaId/broadcast')
  broadcast(@Param('caixaId') caixaId: string, @Body() body: { event?: string; payload?: string | object }) {
    if (body?.event) this.stream.emit(caixaId, body.event, body.payload);
    return { ok: true };
  }

  @Sse('caixa/:caixaId/stream')
  sse(@Param('caixaId') caixaId: string): Observable<MessageEvent> {
    return this.stream.stream(caixaId);
  }
}
