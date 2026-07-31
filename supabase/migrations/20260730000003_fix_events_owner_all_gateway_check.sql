-- =============================================================
-- CORRIGE REGRESSÃO introduzida por 20260730000002_organization_admins.sql
--
-- Aquela migration fez DROP + CREATE de "events_owner_all" pra trocar
-- is_org_owner() por is_org_admin(), mas não sabia que essa mesma policy
-- já tinha sido estendida DUAS VEZES via ALTER POLICY ... WITH CHECK
-- (20260723000002 e 20260723000004) com a trava "não deixa publicar
-- evento sem conta de pagamento conectada" — DROP+CREATE apagou essa
-- trava sem querer. Restaura a trava, mantendo o is_org_admin() novo.
-- =============================================================

DROP POLICY IF EXISTS "events_owner_all" ON public.events;

CREATE POLICY "events_owner_all" ON public.events
  FOR ALL USING (is_org_admin(organization_id))
  WITH CHECK (
    is_org_admin(organization_id)
    AND (
      status <> 'publicado'
      OR (
        COALESCE(payment_gateway, 'mercadopago') = 'pagbank'
        AND EXISTS (SELECT 1 FROM public.promotor_pagbank_accounts WHERE user_id = auth.uid())
      )
      OR (
        COALESCE(payment_gateway, 'mercadopago') <> 'pagbank'
        AND EXISTS (SELECT 1 FROM public.promotor_mp_accounts WHERE user_id = auth.uid())
      )
    )
  );
