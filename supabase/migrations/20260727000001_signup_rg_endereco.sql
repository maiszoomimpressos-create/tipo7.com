-- Estende o trigger de criação de profile no signup pra também aceitar
-- RG e endereço vindos do raw_user_meta_data — usado quando o cadastro é
-- pré-preenchido a partir de um match confirmado na Autosave (CPF + prova
-- de conhecimento de telefone/email). Totalmente retrocompatível: signups
-- que não mandam esses campos continuam recebendo NULL, como já acontecia.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, full_name, phone, cpf, birth_date, user_code,
    rg, zip_code, street, street_number, neighborhood, city, state, complement
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'cpf',
    NULLIF(NEW.raw_user_meta_data->>'birth_date', '')::DATE,
    public.generate_user_code(),
    NEW.raw_user_meta_data->>'rg',
    NEW.raw_user_meta_data->>'zip_code',
    NEW.raw_user_meta_data->>'street',
    NEW.raw_user_meta_data->>'street_number',
    NEW.raw_user_meta_data->>'neighborhood',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    NEW.raw_user_meta_data->>'complement'
  );
  RETURN NEW;
END;
$function$;
