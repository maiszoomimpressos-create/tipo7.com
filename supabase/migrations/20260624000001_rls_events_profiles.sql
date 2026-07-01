-- =============================================================
-- MIGRATION: RLS para events e profiles
--
-- PROBLEMA: events e profiles não tinham RLS ativada, permitindo
-- que qualquer pessoa com a anon key lesse todos os eventos
-- (incluindo rascunhos) e todos os perfis (CPF, telefone, etc).
-- =============================================================

-- ─── EVENTOS ───────────────────────────────────────────────────

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Eventos publicados, cancelados e encerrados são visíveis ao público
CREATE POLICY "events_public_select"
  ON public.events FOR SELECT
  USING (status IN ('publicado', 'cancelado', 'encerrado'));

-- Dono vê e gerencia todos os seus eventos, inclusive rascunhos
CREATE POLICY "events_owner_all"
  ON public.events FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT id FROM public.organizations WHERE owner_id = auth.uid()
    )
  );

-- ─── PERFIS ────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Usuário lê apenas o próprio perfil
CREATE POLICY "profiles_own_select"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Usuário edita apenas o próprio perfil
CREATE POLICY "profiles_own_update"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERT via trigger handle_new_user (SECURITY DEFINER) — não precisa de política
-- O trigger roda como superuser e bypassa RLS automaticamente
