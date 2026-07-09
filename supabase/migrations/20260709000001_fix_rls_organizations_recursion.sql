-- =============================================================
-- MIGRATION: Corrige recursão infinita nas políticas RLS
--
-- PROBLEMA: Ciclo de recursão
--   events_owner_all → lê organizations (via SELECT)
--   members read their organization → lê organization_members
--   owner gerencia organization_members → lê organizations novamente
--   → infinite recursion detected in policy for relation "organizations"
--
-- SOLUÇÃO: SECURITY DEFINER function que lê organizations como
-- superusuário (sem acionar RLS), quebrando o ciclo.
-- =============================================================

-- Função auxiliar: verifica se auth.uid() é dono da org
-- SECURITY DEFINER → roda como superuser, ignora RLS em organizations
CREATE OR REPLACE FUNCTION public.is_org_owner(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM organizations
    WHERE id = org_id AND owner_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_org_owner(UUID) TO authenticated, anon;

-- ── Corrige events_owner_all ───────────────────────────────────
-- Antes: SELECT direto em organizations (acionava RLS → recursão)
-- Depois: usa função SECURITY DEFINER (sem RLS em organizations)

DROP POLICY IF EXISTS "events_owner_all" ON public.events;

CREATE POLICY "events_owner_all"
  ON public.events FOR ALL
  USING (is_org_owner(organization_id))
  WITH CHECK (is_org_owner(organization_id));

-- ── Corrige owner gerencia organization_members ────────────────
-- Esta era a política que fechava o ciclo de recursão

DROP POLICY IF EXISTS "owner gerencia organization_members" ON public.organization_members;

CREATE POLICY "owner gerencia organization_members"
  ON public.organization_members FOR ALL
  USING (is_org_owner(organization_members.organization_id))
  WITH CHECK (is_org_owner(organization_members.organization_id));
