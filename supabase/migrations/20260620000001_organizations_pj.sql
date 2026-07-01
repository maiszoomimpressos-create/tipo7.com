-- Adiciona campos PJ, venue e código único à tabela organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS cnpj           TEXT,
  ADD COLUMN IF NOT EXISTS nome_fantasia  TEXT,
  ADD COLUMN IF NOT EXISTS codigo         TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS capacity       INTEGER,
  ADD COLUMN IF NOT EXISTS zip_code       TEXT,
  ADD COLUMN IF NOT EXISTS street         TEXT,
  ADD COLUMN IF NOT EXISTS street_number  TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood   TEXT,
  ADD COLUMN IF NOT EXISTS city           TEXT,
  ADD COLUMN IF NOT EXISTS state          CHAR(2),
  ADD COLUMN IF NOT EXISTS complement     TEXT;

-- Ativa RLS (não estava ativada)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Dono gerencia sua própria organização
CREATE POLICY "owner manages own organization"
  ON public.organizations FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Membros leem a organização à qual pertencem
CREATE POLICY "members read their organization"
  ON public.organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Estabelecimentos são públicos (busca de venues)
CREATE POLICY "public reads establishments"
  ON public.organizations FOR SELECT
  USING (type = 'estabelecimento');
