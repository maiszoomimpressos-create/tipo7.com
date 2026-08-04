import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { getIp } from '../common/rate-limit.util';
import { CheckoutService } from './checkout.service';

// Porte 1:1 das rotas web/src/app/api/checkout/**.
@UseGuards(SupabaseJwtGuard)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  criarPreference(@CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Body() body: any) {
    return this.checkout.criarPreference(user.id, user.email, user.fullName, getIp(req), body);
  }

  @Post('pix')
  criarPix(@CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Body() body: any) {
    return this.checkout.criarPix(user.id, user.email, user.fullName, getIp(req), body);
  }

  @Post('card')
  criarCard(@CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Body() body: any) {
    return this.checkout.criarCard(user.id, user.email, getIp(req), body);
  }

  @Get('gateway')
  getGateway(@Query('eventoId') eventoId?: string) {
    if (!eventoId) throw new BadRequestException('eventoId obrigatório');
    return this.checkout.getGateway(eventoId);
  }

  @Get('mp-config')
  getMpConfig(@Query('eventoId') eventoId?: string) {
    if (!eventoId) throw new BadRequestException('eventoId required');
    return this.checkout.getMpConfig(eventoId);
  }

  @Get('pix/status/:orderId')
  statusPix(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.checkout.statusPix(user.id, orderId);
  }

  @Post('pagbank-pix')
  criarPagbankPix(@CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Body() body: any) {
    return this.checkout.criarPagbankPix(user.id, user.email, getIp(req), body);
  }

  @Get('pagbank-pix/status/:orderId')
  statusPagbankPix(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.checkout.statusPagbankPix(user.id, orderId);
  }

  @Post('pagbank-card')
  criarPagbankCard(@CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Body() body: any) {
    return this.checkout.criarPagbankCard(user.id, user.email, getIp(req), body);
  }

  @Get('pagbank-config')
  getPagbankConfig() {
    return this.checkout.getPagbankConfig();
  }
}
