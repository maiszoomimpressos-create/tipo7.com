-- BUG: a migration 20260706000001_user_code.sql substituiu handle_new_user()
-- por uma versão que só grava full_name + user_code, perdendo phone/cpf/
-- birth_date que o cadastro sempre exigiu e enviou. Todo cadastro feito
-- entre 06/07/2026 e agora perdeu esses três campos silenciosamente.

-- 1) Corrige a função pra frente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, cpf, birth_date, user_code)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'cpf',
    NULLIF(NEW.raw_user_meta_data->>'birth_date', '')::DATE,
    public.generate_user_code()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) Recupera os dados de quem já se cadastrou nesse período e perdeu os
--    campos — auth.users.raw_user_meta_data ainda guarda o que foi enviado
--    no formulário. Roda linha a linha e pula silenciosamente qualquer
--    conflito de valor único (ex.: telefone duplicado entre duas contas),
--    pra não abortar a recuperação inteira por causa de um caso isolado.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT p.id,
           u.raw_user_meta_data->>'phone' AS meta_phone,
           u.raw_user_meta_data->>'cpf'   AS meta_cpf,
           NULLIF(u.raw_user_meta_data->>'birth_date', '')::DATE AS meta_birth_date
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE (p.phone IS NULL OR p.cpf IS NULL OR p.birth_date IS NULL)
      AND (u.raw_user_meta_data->>'phone' IS NOT NULL
        OR u.raw_user_meta_data->>'cpf' IS NOT NULL
        OR u.raw_user_meta_data->>'birth_date' IS NOT NULL)
  LOOP
    BEGIN
      UPDATE public.profiles
      SET
        phone      = COALESCE(phone, rec.meta_phone),
        cpf        = COALESCE(cpf, rec.meta_cpf),
        birth_date = COALESCE(birth_date, rec.meta_birth_date)
      WHERE id = rec.id;
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'profiles.id % pulado por conflito de valor único na recuperação', rec.id;
    END;
  END LOOP;
END;
$$;
