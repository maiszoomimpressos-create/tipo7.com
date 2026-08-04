import { Controller, Delete, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { getSupabaseCookieUser } from '../auth/supabase-cookie.util';
import { PagbankService } from './pagbank.service';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tipo7.com';

// GET /pagbank/auth e /pagbank/callback são navegação de página inteira
// (<a href>, redirect do PagBank) — mesmo padrão de mp.controller.ts.
@Controller('pagbank')
export class PagbankController {
  constructor(private readonly pagbank: PagbankService) {}

  @Get('auth')
  async auth(@Req() req: Request, @Res() res: Response, @Query('return_to') returnTo?: string) {
    const user = await getSupabaseCookieUser(req);
    if (!user) return res.redirect(`${APP_URL}/auth`);

    const { url, csrfState } = await this.pagbank.buildAuthorizeUrl(returnTo ?? '');
    res.cookie('pagbank_oauth_state', csrfState, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600_000, // 10 minutos (Express usa ms, não segundos)
      path: '/',
    });
    return res.redirect(url);
  }

  @Get('callback')
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') erro?: string,
    @Query('error_description') erroDescricao?: string,
  ) {
    const stateGuardado = req.cookies?.['pagbank_oauth_state'];
    res.clearCookie('pagbank_oauth_state', { path: '/' });

    const user = await getSupabaseCookieUser(req);
    const destino = await this.pagbank.handleCallback({ code, state, erro, erroDescricao, stateGuardado, userId: user?.id });
    return res.redirect(destino);
  }

  @UseGuards(SupabaseJwtGuard)
  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.pagbank.status(user.id);
  }

  @UseGuards(SupabaseJwtGuard)
  @Post('refresh')
  refresh(@CurrentUser() user: AuthenticatedUser) {
    return this.pagbank.refresh(user.id);
  }

  @UseGuards(SupabaseJwtGuard)
  @Delete('disconnect')
  disconnect(@CurrentUser() user: AuthenticatedUser) {
    return this.pagbank.disconnect(user.id);
  }
}
