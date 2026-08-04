import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { createSupabaseCookieClient } from '../supabase-cookie.util';
import type { AuthenticatedUser } from '../strategies/supabase-jwt.strategy';

// Guard para as 4 rotas de OAuth (mp/pagbank auth+callback) navegadas via
// <a href>/redirect do provedor — não podem carregar Authorization: Bearer.
// Ver supabase-cookie.util.ts.
@Injectable()
export class SupabaseCookieAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const supabase = createSupabaseCookieClient(req);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) throw new UnauthorizedException('Não autenticado');

    (req as Request & { user: AuthenticatedUser }).user = {
      id: user.id,
      email: user.email,
    };
    return true;
  }
}
