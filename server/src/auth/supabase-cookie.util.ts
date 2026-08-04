import { verify } from 'jsonwebtoken';
import type { Request } from 'express';
import type { AuthenticatedUser } from './strategies/supabase-jwt.strategy';

// Nome do arquivo mantido por histórico (Fase 4: mp/pagbank auth+callback
// são navegadas via <a href>/redirect do provedor OAuth — não carregam
// Authorization: Bearer, só o cookie de sessão). A partir da Fase 6 o
// cookie `access_token` já é o próprio JWT emitido pelo AuthModule
// (server/src/auth-core/) — não precisa mais de round-trip nenhum pra
// validar, só verificar localmente com o mesmo secret da SupabaseJwtStrategy.
//
// Variante "macia": devolve null em vez de lançar quando não há sessão —
// usada nas rotas mp/pagbank auth+callback, que respondem com REDIRECT
// (não JSON) tanto no fluxo autenticado quanto no não-autenticado.
export async function getSupabaseCookieUser(req: Request): Promise<AuthenticatedUser | null> {
  const token = req.cookies?.['access_token'];
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET não configurado');

  try {
    const payload = verify(token, secret, { algorithms: ['HS256'] }) as {
      sub: string;
      email?: string;
      role?: string;
      user_metadata?: { full_name?: string };
    };
    return { id: payload.sub, email: payload.email, role: payload.role, fullName: payload.user_metadata?.full_name };
  } catch {
    return null;
  }
}
