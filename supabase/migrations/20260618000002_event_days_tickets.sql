-- =============================================================
-- Estrutura de dias e ingressos por evento
-- Suporta eventos de 1 ou múltiplos dias, com ingressos
-- individuais por dia, pacote completo, ou ambos
-- =============================================================

-- Modo de venda de ingressos
DO $$ BEGIN
  CREATE TYPE ticket_mode AS ENUM ('individual', 'pacote', 'ambos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Adiciona campos de controle de ingressos na tabela events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ticket_mode        ticket_mode,
  ADD COLUMN IF NOT EXISTS package_discount_pct INTEGER DEFAULT 0;

-- =============================================================
-- TABELA: event_days
-- Um registro por dia do evento
-- =============================================================
CREATE TABLE IF NOT EXISTS public.event_days (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  day_number  INTEGER     NOT NULL,           -- 1, 2, 3, 4...
  date        DATE        NOT NULL,
  start_time  TIME,
  end_time    TIME,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (event_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_event_days_event_id ON public.event_days(event_id);

-- =============================================================
-- TABELA: event_day_attractions
-- Atrações/artistas por dia
-- =============================================================
CREATE TABLE IF NOT EXISTS public.event_day_attractions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_day_id UUID        NOT NULL REFERENCES public.event_days(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  description  TEXT,
  order_index  INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================================
-- TABELA: event_tickets
-- Tipos de ingresso (Pista, VIP, Camarote, etc.)
-- event_day_id NULL = ingresso de pacote (todos os dias)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.event_tickets (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_day_id UUID        REFERENCES public.event_days(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,           -- "Pista", "VIP", "Camarote"
  description  TEXT,
  price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantity     INTEGER     NOT NULL DEFAULT 0,
  order_index  INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_tickets_event_id     ON public.event_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_event_day_id ON public.event_tickets(event_day_id);

CREATE TRIGGER trg_event_tickets_updated_at
  BEFORE UPDATE ON public.event_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================
-- RLS
-- =============================================================
ALTER TABLE public.event_days           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_day_attractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_tickets        ENABLE ROW LEVEL SECURITY;

-- Dono do evento gerencia os dias
CREATE POLICY "owner manages event_days"
  ON public.event_days FOR ALL
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      JOIN public.organizations o ON o.id = e.organization_id
      WHERE o.owner_id = auth.uid()
    )
  );

-- Dono do evento gerencia as atrações
CREATE POLICY "owner manages event_day_attractions"
  ON public.event_day_attractions FOR ALL
  USING (
    event_day_id IN (
      SELECT d.id FROM public.event_days d
      JOIN public.events e ON e.id = d.event_id
      JOIN public.organizations o ON o.id = e.organization_id
      WHERE o.owner_id = auth.uid()
    )
  );

-- Dono do evento gerencia os ingressos
CREATE POLICY "owner manages event_tickets"
  ON public.event_tickets FOR ALL
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      JOIN public.organizations o ON o.id = e.organization_id
      WHERE o.owner_id = auth.uid()
    )
  );

-- Compradores podem ler ingressos de eventos publicados
CREATE POLICY "public reads published tickets"
  ON public.event_tickets FOR SELECT
  USING (
    event_id IN (SELECT id FROM public.events WHERE status = 'publicado')
  );
