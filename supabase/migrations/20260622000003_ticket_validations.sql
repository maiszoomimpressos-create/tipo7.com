-- Log de auditoria de todas as leituras de QR code na entrada.
-- Registra quem autorizou cada entrada, quando e o resultado.
CREATE TABLE IF NOT EXISTS public.ticket_validations (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id    UUID        REFERENCES public.tickets(id) ON DELETE SET NULL,
  event_id     UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  scanned_by   UUID        NOT NULL REFERENCES public.profiles(id),
  scanned_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  result       TEXT        NOT NULL CHECK (result IN ('valid','already_used','invalid','wrong_event','cancelled')),
  raw_token    TEXT
);

ALTER TABLE public.ticket_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "validations_insert"
  ON public.ticket_validations FOR INSERT
  WITH CHECK (true);

-- Cada staff vê apenas suas próprias leituras; organizador vê via service client
CREATE POLICY "validations_staff_select"
  ON public.ticket_validations FOR SELECT
  USING (scanned_by = auth.uid());
