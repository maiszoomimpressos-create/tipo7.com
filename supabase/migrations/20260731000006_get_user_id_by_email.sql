-- Permite achar o id de um usuário pelo e-mail (usado no convite de sócio
-- em organization_admins) — email só existe em auth.users, não em
-- profiles, e auth.users não é exposto via PostgREST direto.
create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
