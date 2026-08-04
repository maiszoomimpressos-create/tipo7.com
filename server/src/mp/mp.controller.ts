import { Controller, Delete, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { getSupabaseCookieUser } from '../auth/supabase-cookie.util';
import { MpService } from './mp.service';

// GET /mp/auth e /mp/callback são navegação de página inteira (<a href>,
// redirect do MP) — não carregam Authorization: Bearer, por isso usam a
// sessão via cookie (getSupabaseCookieUser) em vez do SupabaseJwtGuard.
@Controller('mp')
export class MpController {
  constructor(private readonly mp: MpService) {}

  @Get('auth')
  async auth(@Req() req: Request, @Res() res: Response, @Query('return_to') returnTo?: string) {
    const user = await getSupabaseCookieUser(req);
    if (!user) return res.redirect('https://www.tipo7.com/auth');

    const { url, csrfState } = await this.mp.buildAuthorizeUrl(returnTo ?? '');
    res.cookie('mp_oauth_state', csrfState, {
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
  ) {
    const stateGuardado = req.cookies?.['mp_oauth_state'];
    res.clearCookie('mp_oauth_state', { path: '/' });

    const user = await getSupabaseCookieUser(req);
    const destino = await this.mp.handleCallback({ code, state, erro, stateGuardado, userId: user?.id });
    return res.redirect(destino);
  }

  @UseGuards(SupabaseJwtGuard)
  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.mp.status(user.id);
  }

  @UseGuards(SupabaseJwtGuard)
  @Post('refresh')
  refresh(@CurrentUser() user: AuthenticatedUser) {
    return this.mp.refresh(user.id);
  }

  @UseGuards(SupabaseJwtGuard)
  @Delete('disconnect')
  disconnect(@CurrentUser() user: AuthenticatedUser) {
    return this.mp.disconnect(user.id);
  }
}
