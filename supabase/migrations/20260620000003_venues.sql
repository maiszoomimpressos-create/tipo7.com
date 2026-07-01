-- Tabela de locais reutilizáveis na plataforma
-- Quando um estabelecimento se cadastra, seu endereço vira um venue.
-- Quando um promotor seleciona um local via Google Places, esse local é salvo aqui.
CREATE TABLE IF NOT EXISTS public.venues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  google_place_id TEXT UNIQUE,
  zip_code        TEXT,
  street          TEXT,
  street_number   TEXT,
  neighborhood    TEXT,
  city            TEXT,
  state           CHAR(2),
  complement      TEXT,
  lat             NUMERIC(10,7),
  lng             NUMERIC(10,7),
  capacity        INTEGER,
  owner_org_id    UUID REFERENCES public.organizations(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public reads venues" ON public.venues
  FOR SELECT USING (true);

CREATE POLICY "org owner manages venue" ON public.venues
  FOR ALL USING (
    owner_org_id IS NULL OR
    owner_org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
  ) WITH CHECK (
    owner_org_id IS NULL OR
    owner_org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
  );

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id);
