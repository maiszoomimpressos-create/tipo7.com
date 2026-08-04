import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { AreaRestritaService } from './area-restrita.service';

// Usar sempre depois do SupabaseJwtGuard (precisa de req.user já resolvido).
@Injectable()
export class AreaRestritaGuard implements CanActivate {
  constructor(private readonly areaRestrita: AreaRestritaService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Não autenticado');

    if (!this.areaRestrita.estaDesbloqueada(req, userId)) {
      throw new ForbiddenException('Área restrita bloqueada');
    }
    return true;
  }
}
