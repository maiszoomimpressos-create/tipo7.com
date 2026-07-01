-- Tabela de portadores de ingressos: quem vai usar cada ingresso
CREATE TABLE IF NOT EXISTS public.ticket_holders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  slot_number   INTEGER NOT NULL,
  full_name     TEXT NOT NULL,
  cpf           TEXT NOT NULL,
  email         TEXT NOT NULL,
  birth_date    DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_item_id, slot_number)
);

ALTER TABLE public.ticket_holders ENABLE ROW LEVEL SECURITY;

-- Dono do pedido pode gerenciar os portadores dos seus ingressos
CREATE POLICY "owner manages holders" ON public.ticket_holders
  FOR ALL
  USING (
    order_item_id IN (
      SELECT oi.id FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE o.user_id = auth.uid()
    )
  )
  WITH CHECK (
    order_item_id IN (
      SELECT oi.id FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE o.user_id = auth.uid()
    )
  );
