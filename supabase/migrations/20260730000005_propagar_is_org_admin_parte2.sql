-- =============================================================
-- Continuação de 20260730000004 — essas policies existiam SÓ no banco
-- (aplicadas via SQL Editor do Supabase em algum momento, sem migration
-- correspondente neste repositório — confirmado consultando pg_policies
-- ao vivo, não só grep nos arquivos). Mesma propagação: owner_id direto
-- vira is_org_admin().
-- =============================================================

-- ── event_positions / event_position_permissions ─────────────────────────
DROP POLICY IF EXISTS "owner gerencia event_positions" ON public.event_positions;
CREATE POLICY "owner gerencia event_positions" ON public.event_positions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_positions.event_id AND is_org_admin(e.organization_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_positions.event_id AND is_org_admin(e.organization_id))
  );

DROP POLICY IF EXISTS "owner gerencia event_position_permissions" ON public.event_position_permissions;
CREATE POLICY "owner gerencia event_position_permissions" ON public.event_position_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.event_positions ep
      JOIN public.events e ON e.id = ep.event_id
      WHERE ep.id = event_position_permissions.event_position_id AND is_org_admin(e.organization_id)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_positions ep
      JOIN public.events e ON e.id = ep.event_id
      WHERE ep.id = event_position_permissions.event_position_id AND is_org_admin(e.organization_id)
    )
  );

-- ── event_staff: policies de escrita (existem ao vivo, apesar do
--    comentário em 20260706000002 dizer que não existiam) ────────────────
DROP POLICY IF EXISTS "owner gerencia event_staff delete" ON public.event_staff;
CREATE POLICY "owner gerencia event_staff delete" ON public.event_staff
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_staff.event_id AND is_org_admin(e.organization_id))
  );

DROP POLICY IF EXISTS "owner gerencia event_staff insert" ON public.event_staff;
CREATE POLICY "owner gerencia event_staff insert" ON public.event_staff
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_staff.event_id AND is_org_admin(e.organization_id))
  );

DROP POLICY IF EXISTS "owner gerencia event_staff update" ON public.event_staff;
CREATE POLICY "owner gerencia event_staff update" ON public.event_staff
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_staff.event_id AND is_org_admin(e.organization_id))
  );

-- ── storage: carrossel (existe ao vivo com lógica diferente da tracked em
--    carrossel_slides.sql — preserva a expressão original tal como está,
--    inclusive o "o.name" em vez de "name" solto, que parece um bug
--    pré-existente não relacionado a isso — só troca o owner_id) ─────────
DROP POLICY IF EXISTS "carrossel_insert" ON storage.objects;
CREATE POLICY "carrossel_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'carrossel'
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE (o.id)::text = (storage.foldername(o.name))[1] AND is_org_admin(o.id)
    )
  );

DROP POLICY IF EXISTS "carrossel_delete" ON storage.objects;
CREATE POLICY "carrossel_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'carrossel'
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE (o.id)::text = (storage.foldername(o.name))[1] AND is_org_admin(o.id)
    )
  );

-- ── organizations: "members read" passa a olhar organization_admins
--    (organization_members nunca foi usada pela aplicação, 0 linhas) ─────
DROP POLICY IF EXISTS "members read their organization" ON public.organizations;
CREATE POLICY "members read their organization" ON public.organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM public.organization_admins WHERE user_id = auth.uid() AND status = 'ativo')
  );
