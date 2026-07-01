-- =============================================================
-- MIGRATION 002 — Adiciona data de nascimento ao perfil
-- Também atualiza o trigger de criação de perfil para salvar
-- telefone, CPF e data de nascimento vindos do metadata do Auth
-- =============================================================

-- Adiciona coluna birth_date na tabela profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Atualiza a função que cria o perfil ao cadastrar
-- Agora salva também phone, cpf e birth_date do metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, cpf, birth_date)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'cpf',
    (NEW.raw_user_meta_data->>'birth_date')::DATE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
