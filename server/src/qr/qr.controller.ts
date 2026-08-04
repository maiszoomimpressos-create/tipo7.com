import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import QRCode from 'qrcode';
import { getIp, rateLimitLocal } from '../common/rate-limit.util';

// Porte 1:1 de web/src/app/api/qr/[token]/route.ts — imagem PNG do QR code,
// usada nos emails (clientes de email não suportam data: URIs, mas
// suportam img src com URL absoluta). Sem autenticação: o token em si já é
// o segredo (HMAC não adivinhável).
@Controller('qr')
export class QrController {
  @Get(':token')
  async gerar(@Req() req: Request, @Res() res: Response, @Param('token') token: string) {
    if (!rateLimitLocal(getIp(req), 'qr-image', 60, 60_000)) {
      return res.status(429).send('Too many requests');
    }
    if (!token) return res.status(400).send('Token inválido');

    const png = await QRCode.toBuffer(token, {
      width: 300,
      margin: 2,
      color: { dark: '#070707', light: '#ffffff' },
    });

    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    return res.send(png);
  }
}
