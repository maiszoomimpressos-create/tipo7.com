-- Adiciona campo RG ao perfil do usuário (sem unicidade — RGs podem repetir entre estados)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rg TEXT;
