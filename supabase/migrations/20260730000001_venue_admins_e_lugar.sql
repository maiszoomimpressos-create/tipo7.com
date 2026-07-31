-- =============================================================
-- Separa "estabelecimento" (lugar físico) de "organização" (pessoa/empresa
-- que opera e fatura eventos). Até aqui, type='estabelecimento' em
-- organizations tratava o lugar como se fosse uma pessoa dona (owner_id
-- único) — impedindo que outro promotor realizasse evento no mesmo lugar
-- em outra data.
--
-- Modelo novo:
--   venues        = o lugar físico (endereço, capacidade, estacionamento —
--                    já existia, ganha código T7, CNPJ, nome fantasia, nicho)
--   venue_admins  = quem administra/cuida do lugar (N pessoas por lugar,
--                    N lugares por pessoa) — substitui organization_members,
--                    que existe no schema mas nunca foi usada pela aplicação
--   organizations = só type='promotora' daqui pra frente (quem opera/fatura
--                    o evento). As linhas existentes de type='estabelecimento'
--                    NÃO são apagadas nem alteradas — têm eventos reais
--                    atrelados via events.organization_id — só deixam de ser
--                    criadas; a identidade delas é espelhada pra venues+
--                    venue_admins nesta migration.
-- =============================================================

-- ── 1. venues ganha os campos que hoje só existem em organizations ──────
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS codigo        TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS cnpj          TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS nome_fantasia TEXT,
  ADD COLUMN IF NOT EXISTS nicho         TEXT CHECK (nicho IN ('eventos', 'estacionamento', 'ambos')),
  ADD COLUMN IF NOT EXISTS phone         TEXT;

-- ── 2. venue_admins — quem administra cada lugar ─────────────────────────
CREATE TABLE IF NOT EXISTS public.venue_admins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'admin'  CHECK (role IN ('admin', 'gerente')),
  status      TEXT NOT NULL DEFAULT 'ativo'  CHECK (status IN ('ativo', 'convidado', 'removido')),
  invited_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (venue_id, user_id)
);

ALTER TABLE public.venue_admins ENABLE ROW LEVEL SECURITY;

-- Cada um só lê suas próprias associações. Escrita (convite/promoção) fica
-- só via service role nas rotas de API — não há regra de convite/aprovação
-- ainda, não faz sentido abrir INSERT/UPDATE/DELETE pro client agora.
CREATE POLICY "self reads own venue_admins" ON public.venue_admins
  FOR SELECT USING (user_id = auth.uid());

-- ── 3. generate_org_code: código de estabelecimento passa a checar venues ──
CREATE OR REPLACE FUNCTION public.generate_org_code(p_tipo TEXT)
RETURNS TEXT AS $$
DECLARE
  v_categoria TEXT;
  v_codigo    TEXT;
  v_taken     BOOLEAN;
BEGIN
  v_categoria := CASE WHEN p_tipo = 'promotora' THEN 'P' ELSE 'E' END;
  LOOP
    v_codigo := public.t7_sortear_codigo(v_categoria);
    IF p_tipo = 'promotora' THEN
      SELECT EXISTS(SELECT 1 FROM public.organizations WHERE codigo = v_codigo) INTO v_taken;
    ELSE
      SELECT EXISTS(SELECT 1 FROM public.venues WHERE codigo = v_codigo) INTO v_taken;
    END IF;
    EXIT WHEN NOT v_taken;
  END LOOP;
  RETURN v_codigo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Backfill: espelha as organizations type='estabelecimento' existentes
--        em venues + venue_admins, preservando o código T7 já emitido ──────
DO $$
DECLARE
  org  RECORD;
  v_id UUID;
BEGIN
  FOR org IN SELECT * FROM public.organizations WHERE type = 'estabelecimento' LOOP

    SELECT id INTO v_id FROM public.venues WHERE owner_org_id = org.id LIMIT 1;

    IF v_id IS NULL THEN
      INSERT INTO public.venues (name, zip_code, street, street_number, neighborhood, city, state, complement, capacity, owner_org_id)
      VALUES (
        COALESCE(org.nome_fantasia, org.name), org.zip_code, org.street, org.street_number,
        org.neighborhood, org.city, org.state, org.complement, org.capacity, org.id
      )
      RETURNING id INTO v_id;
    END IF;

    UPDATE public.venues SET
      codigo        = COALESCE(venues.codigo, org.codigo),
      cnpj          = COALESCE(venues.cnpj, org.cnpj),
      nome_fantasia = COALESCE(venues.nome_fantasia, org.nome_fantasia),
      nicho         = COALESCE(venues.nicho, org.nicho),
      phone         = COALESCE(venues.phone, org.phone)
    WHERE id = v_id;

    INSERT INTO public.venue_admins (venue_id, user_id, role, status)
    VALUES (v_id, org.owner_id, 'admin', 'ativo')
    ON CONFLICT (venue_id, user_id) DO NOTHING;

  END LOOP;
END;
$$;
