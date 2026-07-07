-- Adiciona vender_ingresso ao enum event_permission
-- (estava no frontend mas faltava no banco)
ALTER TYPE public.event_permission ADD VALUE IF NOT EXISTS 'vender_ingresso';
