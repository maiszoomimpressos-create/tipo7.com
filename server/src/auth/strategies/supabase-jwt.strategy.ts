import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  user_metadata?: { full_name?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
  fullName?: string;
}

// Nome do arquivo/classe mantido por histórico (Fase 0-5 validava o JWT da
// Supabase via JWKS) — a partir da Fase 6 valida o JWT emitido pelo próprio
// AuthModule (server/src/auth-core/), com um secret HS256 local. Renomear
// tocaria só neste arquivo (SupabaseJwtGuard/CurrentUser são referenciados
// por nome de import em ~40 controllers, não pelo nome da strategy), mas
// não há necessidade real de tocar nesses imports — o shape de saída
// (AuthenticatedUser) continua idêntico.
//
// Aceita o token tanto via `Authorization: Bearer` (fetch/apiFetchAuth)
// quanto via cookie `access_token` (navegação de página inteira — mp/pagbank
// auth+callback, Fase 4) — um só guard cobre os dois casos agora.
@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(Strategy, 'supabase-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => req.cookies?.['access_token'] ?? null,
      ]),
      algorithms: ['HS256'],
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      fullName: payload.user_metadata?.full_name,
    };
  }
}
