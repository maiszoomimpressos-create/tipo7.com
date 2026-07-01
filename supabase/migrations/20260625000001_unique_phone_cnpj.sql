-- Impede cadastros duplicados por telefone e CNPJ

-- Telefone único por usuário (profiles)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_unique UNIQUE (phone);

-- CNPJ único por organização
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_cnpj_unique UNIQUE (cnpj);
