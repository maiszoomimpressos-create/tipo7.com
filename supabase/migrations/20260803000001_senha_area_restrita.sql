-- =============================================================
-- Senha própria de acesso à área restrita (Equipe, Financeiro, API).
-- Continuação de 20260731000003_acesso_restrito.sql: acesso_restrito=true
-- concede o DIREITO de entrar, mas agora também é preciso desbloquear com
-- senha própria (step-up auth) — cada pessoa cadastra a sua na primeira
-- vez que acessa /admin/area-restrita. Hash em pbkdf2 (sem dependência
-- nova), formato "salt:hash" em hex.
-- =============================================================

ALTER TABLE public.platform_team
  ADD COLUMN IF NOT EXISTS senha_restrita_hash TEXT;
