import 'server-only';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

// Porte server-side do getAuthUser — substitui as ~35 chamadas de
// `supabase.auth.getUser()` em Server Components/rotas (Fase 6). Verifica
// o cookie `access_token` localmente (mesmo JWT_SECRET do server/, HS256)
// — sem round-trip nenhum, ao contrário do que a Supabase exigia.
export interface AuthUser {
  id: string;
  email: string | null;
  user_metadata: { full_name?: string };
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? '');

export async function getAuthUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get('access_token')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string') return null;
    const userMetadata = (payload.user_metadata as { full_name?: string } | undefined) ?? {};
    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null,
      user_metadata: userMetadata,
    };
  } catch {
    return null;
  }
}
