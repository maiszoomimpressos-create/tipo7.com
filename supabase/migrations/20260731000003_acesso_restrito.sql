-- =============================================================
-- Área restrita do admin (Equipe, Financeiro, API) — acesso explícito,
-- separado da hierarquia normal de roles. Antes, qualquer membro
-- role='admin' passava automaticamente pela function can() (bypassa
-- permissions[]); a partir de agora essas telas exigem
-- role='super_admin' OU acesso_restrito=true especificamente — 'admin'
-- sozinho não basta mais. Preparado pro fluxo de senha própria de
-- admin master/supervisor que vem depois; por ora é só o flag.
-- =============================================================

ALTER TABLE public.platform_team
  ADD COLUMN IF NOT EXISTS acesso_restrito BOOLEAN NOT NULL DEFAULT FALSE;

-- maiszoomimpressos@gmail.com (dono da plataforma) — acesso total
UPDATE public.platform_team
  SET acesso_restrito = true
  WHERE user_id = 'ace2420b-009b-4d9b-bec1-dee6cf52ae83';
