import { createServerClient } from '@supabase/ssr';
import type { Request } from 'express';

// Rotas mp/auth, mp/callback, pagbank/auth, pagbank/callback são navegadas
// via <a href> / redirect do provedor OAuth — não passam por fetch, então
// não carregam Authorization: Bearer (só SupabaseJwtStrategy não serve
// aqui). Usa o mesmo mecanismo do web/src/proxy.ts: cria um client
// @supabase/ssr lendo os cookies da sessão (sb-<ref>-auth-token, possivelmente
// em chunks .0/.1/...) e valida contra o servidor de Auth da Supabase via
// getUser() — não decodifica o JWT localmente, delega a validação real.
export function createSupabaseCookieClient(req: Request) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY não configurados');

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => Object.entries(req.cookies ?? {}).map(([name, value]) => ({ name, value: String(value) })),
      // Só leitura — não precisamos reescrever cookies nessas rotas.
      setAll: () => {},
    },
  });
}

// Variante "macia": devolve null em vez de lançar quando não há sessão —
// usada nas rotas mp/pagbank auth+callback, que respondem com REDIRECT
// (não JSON) tanto no fluxo autenticado quanto no não-autenticado (mesmo
// comportamento do route.ts original, que nunca retorna 401 nessas rotas).
export async function getSupabaseCookieUser(req: Request): Promise<{ id: string; email?: string } | null> {
  const supabase = createSupabaseCookieClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email };
}
