-- SEC-01 e SEC-02: políticas de INSERT e UPDATE na tabela tickets estavam abertas.
--
-- "tickets_service_insert" tinha WITH CHECK (true) — qualquer usuário autenticado
-- conseguia inserir tickets falsos usando o anon key publicamente disponível no bundle JS.
--
-- "tickets_service_update" tinha USING (true) — qualquer usuário podia alterar
-- o status de 'used' de volta para 'valid', reutilizando ingressos.
--
-- Fix: remove ambas. O service role (webhook e scanner) bypassa RLS por definição.
-- Sem política de INSERT/UPDATE, usuários normais não conseguem escrever na tabela.

DROP POLICY IF EXISTS "tickets_service_insert" ON public.tickets;
DROP POLICY IF EXISTS "tickets_service_update" ON public.tickets;
