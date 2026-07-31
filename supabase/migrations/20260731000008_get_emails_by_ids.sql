-- Busca e-mails em lote por id (auth.users não é exposto via PostgREST) —
-- usado no painel de Colaboradores pra mostrar e-mail junto com nome/código.
create or replace function public.get_emails_by_ids(p_ids uuid[])
returns table (id uuid, email text)
language sql
security definer
set search_path = public, auth
as $$
  select u.id, u.email from auth.users u where u.id = any(p_ids);
$$;
