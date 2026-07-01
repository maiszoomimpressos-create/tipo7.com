-- =============================================================
-- MIGRATION: tickets
-- Um registro por slot de ingresso comprado.
-- O qr_token é o identificador único para validação na entrada.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.tickets (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id        UUID        NOT NULL REFERENCES public.orders(id)      ON DELETE CASCADE,
  order_item_id   UUID        NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  slot_number     INT         NOT NULL,
  qr_token        TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  status          TEXT        NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'used', 'cancelled')),
  validated_at    TIMESTAMPTZ,
  validated_by    UUID        REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (order_item_id, slot_number),
  UNIQUE (qr_token)
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Comprador vê apenas seus próprios ingressos
CREATE POLICY "tickets_owner_select"
  ON public.tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = tickets.order_id
        AND o.user_id = auth.uid()
    )
  );

-- Service role pode inserir (usado pelo webhook)
CREATE POLICY "tickets_service_insert"
  ON public.tickets FOR INSERT
  WITH CHECK (true);

-- Service role pode atualizar (validação na entrada)
CREATE POLICY "tickets_service_update"
  ON public.tickets FOR UPDATE
  USING (true);
