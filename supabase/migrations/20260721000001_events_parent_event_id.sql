-- Evento dentro do evento: um evento pode ter um evento-pai (mesma organização),
-- com seus próprios event_tickets, caixas e status — reconciliação e vendas separadas.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS parent_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.events
    ADD CONSTRAINT events_parent_not_self CHECK (parent_event_id IS NULL OR parent_event_id <> id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_events_parent_event_id
  ON public.events(parent_event_id) WHERE parent_event_id IS NOT NULL;
