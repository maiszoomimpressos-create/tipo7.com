-- =============================================================
-- MIGRATION: RLS em event_staff
-- Garante que um promotor só enxerga e gerencia a equipe dos
-- próprios eventos — nunca de eventos de terceiros.
-- Escritas (INSERT/UPDATE/DELETE) só passam via service role
-- (API server-side), que ignora RLS por design.
-- =============================================================

ALTER TABLE public.event_staff ENABLE ROW LEVEL SECURITY;

-- Membro vê seus próprios convites/vínculos
CREATE POLICY "staff_ver_proprios"
  ON public.event_staff
  FOR SELECT
  USING (user_id = auth.uid());

-- Dono do evento vê toda a equipe do seu evento
CREATE POLICY "staff_dono_ve_equipe"
  ON public.event_staff
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.organizations o ON o.id = e.organization_id
      WHERE e.id = event_staff.event_id
        AND o.owner_id = auth.uid()
    )
  );

-- Nenhuma policy de escrita via client — toda alteração passa
-- pela API com service role (assertOwner já valida lá).
-- Isso impede que qualquer usuário crie/edite vínculos direto
-- pelo client sem passar pela validação do servidor.
