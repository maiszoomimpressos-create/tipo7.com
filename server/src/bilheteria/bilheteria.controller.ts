import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { BilheteriaService } from './bilheteria.service';

@UseGuards(SupabaseJwtGuard)
@Controller('bilheteria')
export class BilheteriaController {
  constructor(private readonly bilheteria: BilheteriaService) {}

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
}
