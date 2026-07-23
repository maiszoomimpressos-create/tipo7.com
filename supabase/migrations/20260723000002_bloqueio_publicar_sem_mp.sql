-- Trava de segurança em profundidade: mesmo que alguém tente publicar um
-- evento direto pela API do Supabase (pulando a rota /api/eventos/[id]/publicar
-- que já revalida isso), o próprio banco recusa marcar status='publicado'
-- se o dono não tiver conta Mercado Pago conectada — evita que a venda
-- online caia na conta da própria Tipo7 (gera imposto sobre o valor cheio
-- em vez de só a taxa de 10%).
ALTER POLICY "events_owner_all" ON public.events
  WITH CHECK (
    organization_id IN (
      SELECT id FROM public.organizations WHERE owner_id = auth.uid()
    )
    AND (
      status <> 'publicado'
      OR EXISTS (SELECT 1 FROM public.promotor_mp_accounts WHERE user_id = auth.uid())
    )
  );
