-- Adiciona horário previsto para cada atração do dia
ALTER TABLE public.event_day_attractions
  ADD COLUMN IF NOT EXISTS scheduled_time TIME;
