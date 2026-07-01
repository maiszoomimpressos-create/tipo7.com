-- Perfil do promotor de eventos
-- Criado uma única vez por usuário durante o onboarding de criação de eventos
CREATE TABLE IF NOT EXISTS promotor_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  tipo_pessoa TEXT NOT NULL CHECK (tipo_pessoa IN ('pf', 'pj')),
  tipo_espaco TEXT NOT NULL CHECK (tipo_espaco IN ('proprio', 'alugado')),
  num_socios  TEXT NOT NULL CHECK (num_socios IN ('1', '2-5', '6+')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Sócios vinculados ao perfil do promotor
CREATE TABLE IF NOT EXISTS promotor_socios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotor_id UUID REFERENCES promotor_profiles(id) ON DELETE CASCADE NOT NULL,
  nome        TEXT NOT NULL,
  cpf         TEXT NOT NULL,
  email       TEXT,
  telefone    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE promotor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotor_socios    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns promotor_profile"
  ON promotor_profiles FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user owns socios via promotor"
  ON promotor_socios FOR ALL
  USING (promotor_id IN (SELECT id FROM promotor_profiles WHERE user_id = auth.uid()))
  WITH CHECK (promotor_id IN (SELECT id FROM promotor_profiles WHERE user_id = auth.uid()));
