-- =============================================================
-- Substitui admin.auth.admin.listUsers({ perPage: 1000 }) + scan em memória
-- (usado em 6 lugares pra achar usuário por email, ou mapear vários ids
-- pra email) por duas functions que consultam auth.users diretamente,
-- usando o índice único de email já existente ali.
--
-- Motivação: listUsers baixa até 1000 usuários inteiros pela API HTTP do
-- GoTrue toda vez que alguém busca por email — lento (rede + parse) e
-- **incorreto acima de 1000 usuários** (o parâmetro perPage não pagina
-- automaticamente, então usuários além do primeiro "page" nunca aparecem
-- na busca). Isso é bug de correção, não só performance.
--
-- SECURITY DEFINER pra poder ler o schema auth; acesso restrito a
-- service_role (mesmo nível de acesso que o código já usa via
-- createServiceClient() — não abre nada que não estivesse já acessível).
-- =============================================================

CREATE OR REPLACE FUNCTION public.find_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_emails(p_ids UUID[])
RETURNS TABLE(id UUID, email TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id, email FROM auth.users WHERE id = ANY(p_ids);
$$;

REVOKE EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_emails(UUID[])      FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT)  TO service_role;
GRANT  EXECUTE ON FUNCTION public.get_user_emails(UUID[])      TO service_role;
