-- get_user_id_by_email e get_emails_by_ids são SECURITY DEFINER e por
-- padrão o Postgres libera EXECUTE pra PUBLIC — o que deixaria qualquer
-- usuário autenticado chamar via RPC do Supabase e descobrir e-mail/id de
-- qualquer pessoa. Essas funções só devem ser chamadas pelo service role
-- (dentro das rotas de API, nunca direto do client).
revoke execute on function public.get_user_id_by_email(text) from public, anon, authenticated;
revoke execute on function public.get_emails_by_ids(uuid[]) from public, anon, authenticated;
grant execute on function public.get_user_id_by_email(text) to service_role;
grant execute on function public.get_emails_by_ids(uuid[]) to service_role;
