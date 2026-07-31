-- =============================================================
-- Propaga is_org_admin() (co-admins de organização) pras demais policies
-- que ainda checavam owner_id = auth.uid() direto — mesma lógica de
-- 20260730000002, só que nos ~14 lugares que faltaram naquela primeira
-- passada (organizations e events já foram cobertos lá, e a regressão
-- em events_owner_all já foi corrigida em 20260730000003).
--
-- Cada policy abaixo preserva exatamente a lógica original (inclusive
-- os casos com OR created_by/fechado_por = auth.uid(), e os SELECT-only
-- de staff), só trocando "o.owner_id = auth.uid()" por
-- "is_org_admin(o.id)" (ou equivalente já reduzido pra
-- is_org_admin(organization_id) quando a coluna já está no escopo).
-- =============================================================

-- ── event_days / event_day_attractions / event_tickets ──────────────────
DROP POLICY IF EXISTS "owner manages event_days" ON public.event_days;
CREATE POLICY "owner manages event_days" ON public.event_days
  FOR ALL USING (
    event_id IN (SELECT id FROM public.events WHERE is_org_admin(organization_id))
  );

DROP POLICY IF EXISTS "owner manages event_day_attractions" ON public.event_day_attractions;
CREATE POLICY "owner manages event_day_attractions" ON public.event_day_attractions
  FOR ALL USING (
    event_day_id IN (
      SELECT d.id FROM public.event_days d
      JOIN public.events e ON e.id = d.event_id
      WHERE is_org_admin(e.organization_id)
    )
  );

DROP POLICY IF EXISTS "owner manages event_tickets" ON public.event_tickets;
CREATE POLICY "owner manages event_tickets" ON public.event_tickets
  FOR ALL USING (
    event_id IN (SELECT id FROM public.events WHERE is_org_admin(organization_id))
  );

-- ── storage: event-images ────────────────────────────────────────────────
DROP POLICY IF EXISTS "event-images: upload autenticado" ON storage.objects;
CREATE POLICY "event-images: upload autenticado" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'event-images'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id::text = (string_to_array(name, '/'))[1]
      AND is_org_admin(e.organization_id)
    )
  );

DROP POLICY IF EXISTS "event-images: update autenticado" ON storage.objects;
CREATE POLICY "event-images: update autenticado" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'event-images'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id::text = (string_to_array(name, '/'))[1]
      AND is_org_admin(e.organization_id)
    )
  );

DROP POLICY IF EXISTS "event-images: delete autenticado" ON storage.objects;
CREATE POLICY "event-images: delete autenticado" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'event-images'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id::text = (string_to_array(name, '/'))[1]
      AND is_org_admin(e.organization_id)
    )
  );

-- ── venues ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "org owner manages venue" ON public.venues;
CREATE POLICY "org owner manages venue" ON public.venues
  FOR ALL USING (
    owner_org_id IS NULL OR is_org_admin(owner_org_id)
  ) WITH CHECK (
    owner_org_id IS NULL OR is_org_admin(owner_org_id)
  );

-- ── event_attribute_values ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Dono gerencia atributos do evento" ON public.event_attribute_values;
CREATE POLICY "Dono gerencia atributos do evento" ON public.event_attribute_values
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND is_org_admin(e.organization_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND is_org_admin(e.organization_id))
  );

-- ── event_staff ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_dono_ve_equipe" ON public.event_staff;
CREATE POLICY "staff_dono_ve_equipe" ON public.event_staff
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_staff.event_id AND is_org_admin(e.organization_id))
  );

-- ── carrossel_slides ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "owner_all" ON public.carrossel_slides;
CREATE POLICY "owner_all" ON public.carrossel_slides
  FOR ALL USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- ── caixas / caixa_transferencias / caixa_fechamento ─────────────────────
DROP POLICY IF EXISTS "caixas_owner_all" ON public.caixas;
CREATE POLICY "caixas_owner_all" ON public.caixas
  FOR ALL USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = caixas.evento_id AND is_org_admin(e.organization_id))
  );

DROP POLICY IF EXISTS "transferencias_evento_owner" ON public.caixa_transferencias;
CREATE POLICY "transferencias_evento_owner" ON public.caixa_transferencias
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = caixa_transferencias.evento_id AND is_org_admin(e.organization_id))
  );

DROP POLICY IF EXISTS "fechamento_owner" ON public.caixa_fechamento;
CREATE POLICY "fechamento_owner" ON public.caixa_fechamento
  FOR ALL USING (
    fechado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.caixas c JOIN public.events e ON e.id = c.evento_id
      WHERE c.id = caixa_fechamento.caixa_id AND is_org_admin(e.organization_id)
    )
  );

-- ── estacionamentos / estacionamento_sessoes / estacionamento_portoes ────
DROP POLICY IF EXISTS "estacionamentos_owner_all" ON public.estacionamentos;
CREATE POLICY "estacionamentos_owner_all" ON public.estacionamentos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = estacionamentos.event_id AND is_org_admin(e.organization_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = estacionamentos.event_id AND is_org_admin(e.organization_id))
  );

DROP POLICY IF EXISTS "est_sessoes_owner_all" ON public.estacionamento_sessoes;
CREATE POLICY "est_sessoes_owner_all" ON public.estacionamento_sessoes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.estacionamentos p JOIN public.events e ON e.id = p.event_id
      WHERE p.id = estacionamento_sessoes.estacionamento_id AND is_org_admin(e.organization_id)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.estacionamentos p JOIN public.events e ON e.id = p.event_id
      WHERE p.id = estacionamento_sessoes.estacionamento_id AND is_org_admin(e.organization_id)
    )
  );

DROP POLICY IF EXISTS "est_portoes_owner_all" ON public.estacionamento_portoes;
CREATE POLICY "est_portoes_owner_all" ON public.estacionamento_portoes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.estacionamentos p JOIN public.events e ON e.id = p.event_id
      WHERE p.id = estacionamento_portoes.estacionamento_id AND is_org_admin(e.organization_id)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.estacionamentos p JOIN public.events e ON e.id = p.event_id
      WHERE p.id = estacionamento_portoes.estacionamento_id AND is_org_admin(e.organization_id)
    )
  );
