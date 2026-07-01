-- Capacidade máxima de público do evento.
-- A soma de todos os ingressos não pode ultrapassar esse valor.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS capacity INTEGER;
