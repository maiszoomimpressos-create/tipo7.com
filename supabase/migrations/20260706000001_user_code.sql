-- =============================================================
-- MIGRATION: user_code em profiles
-- Todo usuário recebe um código pessoal único (T7-USR-XXXXX)
-- gerado automaticamente no cadastro.
-- =============================================================

-- Adiciona a coluna (nullable para não quebrar registros existentes)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_code TEXT UNIQUE;

-- ---------------------------------------------------------------
-- Função: gera um código T7-USR-XXXXX único
-- Usa apenas letras e números sem ambiguidade (sem I, O, 0, 1)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_user_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  TEXT;
  taken BOOLEAN;
BEGIN
  LOOP
    code := 'T7-USR-';
    FOR i IN 1..5 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_code = code) INTO taken;
    EXIT WHEN NOT taken;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------
-- Atualiza handle_new_user para já gerar o código no cadastro
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, user_code)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    public.generate_user_code()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------
-- Backfill: gera código para usuários que já existem sem um
-- ---------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.profiles WHERE user_code IS NULL LOOP
    UPDATE public.profiles
    SET user_code = public.generate_user_code()
    WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Agora que todos têm código, torna a coluna obrigatória
ALTER TABLE public.profiles
  ALTER COLUMN user_code SET NOT NULL;

-- RLS: qualquer um autenticado pode buscar um perfil pelo user_code
-- (necessário para o sistema de convites pesquisar o usuário)
-- A policy de leitura já existe; apenas garantimos que user_code
-- seja visível nas buscas públicas que já estão liberadas.
