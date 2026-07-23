-- Estende a trava de 20260723000002 (bloqueio de publicação sem conta de
-- pagamento conectada) pra considerar qual gateway o evento usa: eventos
-- PagBank exigem promotor_pagbank_accounts, eventos Mercado Pago (padrão)
-- continuam exigindo promotor_mp_accounts. Mesma razão de antes: evita que
-- a venda caia na conta da própria Tipo7 e gere imposto sobre o valor cheio.
ALTER POLICY "events_owner_all" ON public.events
  WITH CHECK (
    organization_id IN (
      SELECT id FROM public.organizations WHERE owner_id = auth.uid()
    )
    AND (
      status <> 'publicado'
      OR (
        COALESCE(payment_gateway, 'mercadopago') = 'pagbank'
        AND EXISTS (SELECT 1 FROM public.promotor_pagbank_accounts WHERE user_id = auth.uid())
      )
      OR (
        COALESCE(payment_gateway, 'mercadopago') <> 'pagbank'
        AND EXISTS (SELECT 1 FROM public.promotor_mp_accounts WHERE user_id = auth.uid())
      )
    )
  );
