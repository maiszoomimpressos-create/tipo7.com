import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { getIp, rateLimitLocal, tooManyRequests } from '../common/rate-limit.util';
import { HolderLinksService } from './holder-links.service';

// Endpoints do assistente pós-pagamento ("algum desses é seu? preencher ou
// mandar link?") — exige dono do pedido logado.
@UseGuards(SupabaseJwtGuard)
@Controller('orders')
export class HolderLinksController {
  constructor(private readonly holderLinks: HolderLinksService) {}

  @Get(':orderId/holder-resumo')
  resumo(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.holderLinks.resumo(user.id, orderId);
  }

  @Post(':orderId/holder-preencher-meus-dados')
  preencherComMeusDados(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.holderLinks.preencherComMeusDados(user.id, orderId);
  }

  @Post(':orderId/holder-link')
  criarLink(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.holderLinks.criarLink(user.id, orderId);
  }
}

// Rotas públicas — quem recebe o link não tem (necessariamente) conta
// Tipo7. Só rate-limitadas, sem guard (mesmo critério de cadastro/auth.controller.ts).
@Controller('public/holder-links')
export class HolderLinksPublicController {
  constructor(private readonly holderLinks: HolderLinksService) {}

  @Get(':token')
  infoPublica(@Req() req: Request, @Param('token') token: string) {
    if (!rateLimitLocal(getIp(req), 'holder-link-info', 30, 60_000)) tooManyRequests();
    return this.holderLinks.infoPublica(token);
  }

  @Post(':token/reivindicar')
  async reivindicar(@Req() req: Request, @Param('token') token: string, @Body() body: any) {
    if (!rateLimitLocal(getIp(req), 'holder-link-claim', 8, 60_000)) tooManyRequests();
    return this.holderLinks.reivindicar(token, body);
  }
}
