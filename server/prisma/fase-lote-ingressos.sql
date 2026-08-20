-- Lote de ingressos (20/08/2026) — ver project_lote_ingressos na memória.

CREATE TABLE IF NOT EXISTS public.ticket_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.event_tickets(id) ON DELETE CASCADE,
  ordem integer NOT NULL,
  price numeric(10,2) NOT NULL,
  quantity integer NOT NULL,
  data_corte timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_lotes_ticket_id ON public.ticket_lotes (ticket_id);
