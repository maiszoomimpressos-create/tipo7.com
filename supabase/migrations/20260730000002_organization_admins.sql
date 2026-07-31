-- =============================================================
-- Organização deixa de depender só de owner_id (uma pessoa) — mesmo
-- padrão já aplicado em venues/venue_admins: uma organization (promotor
-- solo PF/PJ, ou empresa com sócios/funcionários responsáveis) passa a
-- suportar N pessoas responsáveis, não só o dono original.
--
-- owner_id continua existindo (quem criou/é o dono principal), mas
-- permissão de gerenciar a organização e seus eventos passa a reconhecer
-- também quem estiver em organization_admins — sem quebrar nada que já
-- funciona hoje (o dono sempre é o primeiro admin, via backfill abaixo).
--
-- Não mexe em organization_members (tabela antiga, já morta, com
-- role=platform_role — encaixe errado pro que precisamos aqui) nem em
-- checagens de owner_id que ainda existem direto no código de app
-- (caixas, equipe, estacionamento, financeiro) — essas continuam só
-- reconhecendo o owner_id por enquanto; é um passo seguinte separado.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.organization_admins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'admin'  CHECK (role IN ('admin', 'gerente')),
  status          TEXT NOT NULL DEFAULT 'ativo'  CHECK (status IN ('ativo', 'convidado', 'removido')),
  invited_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.organization_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self reads own organization_admins" ON public.organization_admins
  FOR SELECT USING (user_id = auth.uid());

-- Backfill: todo owner_id vira o primeiro admin da própria organização
INSERT INTO public.organization_admins (organization_id, user_id, role, status)
SELECT id, owner_id, 'admin', 'ativo'
FROM public.organizations
WHERE owner_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ── is_org_admin: owner_id OU membro ativo em organization_admins ──────
-- SECURITY DEFINER, mesmo padrão de is_org_owner — evita recursão de RLS
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM organizations WHERE id = org_id AND owner_id = auth.uid()
  ) OR EXISTS(
    SELECT 1 FROM organization_admins
    WHERE organization_id = org_id AND user_id = auth.uid() AND status = 'ativo'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID) TO authenticated, anon;

-- ── organizations: dono OU admin gerencia ───────────────────────────────
DROP POLICY IF EXISTS "owner manages own organization" ON public.organizations;
CREATE POLICY "admin manages organization" ON public.organizations
  FOR ALL USING (is_org_admin(id)) WITH CHECK (is_org_admin(id));

-- ── events: dono OU admin gerencia (substitui is_org_owner) ─────────────
DROP POLICY IF EXISTS "events_owner_all" ON public.events;
CREATE POLICY "events_owner_all" ON public.events
  FOR ALL USING (is_org_admin(organization_id)) WITH CHECK (is_org_admin(organization_id));
