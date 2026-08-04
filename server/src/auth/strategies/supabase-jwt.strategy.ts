import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface SupabaseJwtPayload {
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

// Interino (Fase 0-5): só valida o JWT emitido pelo Supabase Auth via JWKS.
// Na Fase 6 isso é substituído pelo AuthModule próprio (emissão de JWT no NestJS).
@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(Strategy, 'supabase-jwt') {
  constructor(config: ConfigService) {
    const supabaseUrl = config.getOrThrow<string>('SUPABASE_URL');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['ES256', 'RS256', 'HS256'],
      issuer: `${supabaseUrl}/auth/v1`,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      }),
    });
  }

  validate(payload: SupabaseJwtPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      fullName: payload.user_metadata?.full_name,
    };
  }
}
