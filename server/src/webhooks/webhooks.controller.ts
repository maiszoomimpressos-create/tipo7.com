import { Body, Controller, HttpCode, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { WebhooksService } from './webhooks.service';

// Sem guard — chamado pelo servidor do Mercado Pago/PagBank, não pelo browser.
// @HttpCode(200): NestJS retorna 201 por padrão em POST, mas MP/PagBank
// esperam 200 pra considerar o webhook entregue (mesmo comportamento do
// NextResponse.json({ok:true}) original, que é sempre 200).
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post('mercadopago')
  @HttpCode(200)
  mercadopago(@Req() req: Request, @Body() body: any) {
    return this.webhooks.mercadopago(req.headers, body);
  }

  @Post('pagbank')
  @HttpCode(200)
  pagbank(@Body() body: any) {
    return this.webhooks.pagbank(body);
  }

  @Post('autosave')
  @HttpCode(200)
  autosave(@Req() req: RawBodyRequest<Request>) {
    return this.webhooks.autosave(req.rawBody, (req.headers['x-autosave-signature'] as string | undefined) ?? null);
  }
}
