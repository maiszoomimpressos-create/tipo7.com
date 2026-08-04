-- Fase 6 (corte final) — adições ao schema restaurado do dump da Supabase.
-- Roda DEPOIS de restaurar o dump --schema=public (ver server/prisma/schema.prisma
-- pros models Prisma correspondentes: Profile.email/encryptedPassword/emailVerified,
-- RefreshToken, PasswordResetToken).
--
-- Numa migração de dados real (produção), a coluna email deve ser adicionada
-- SEM NOT NULL, backfilled a partir do dump de auth.users, e só então promovida
-- pra NOT NULL + UNIQUE — nesta versão (schema vazio, pra teste) já cria direto
-- como NOT NULL porque não há linha nenhuma pra violar a constraint.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS encrypted_password text,
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON public.refresh_tokens (user_id);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens (user_id);
