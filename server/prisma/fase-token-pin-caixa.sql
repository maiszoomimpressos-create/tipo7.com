-- Token+PIN pra acesso a caixa (19/08/2026) — ver project_token_pin_acesso_caixa
-- na memória. Adições ao event_staff, aplicadas direto (sem Prisma Migrate,
-- mesmo padrão de fase6-schema-additions.sql).

ALTER TABLE public.event_staff
  ADD COLUMN IF NOT EXISTS token text UNIQUE,
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_tentativas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_bloqueado_ate timestamptz;
