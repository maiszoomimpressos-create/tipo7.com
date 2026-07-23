-- Tabela para guardar as credenciais OAuth Connect do PagBank de cada promotor.
-- Espelha public.promotor_mp_accounts (mesmo modelo de marketplace: o promotor
-- conecta a própria conta, a Tipo7 usa o token dele pra criar pedidos e retém
-- uma taxa de serviço).
CREATE TABLE IF NOT EXISTS public.promotor_pagbank_accounts (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pagbank_account_id    TEXT        NOT NULL,
  pagbank_access_token  TEXT        NOT NULL,
  pagbank_refresh_token TEXT,
  fee_pct               NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id)
);

ALTER TABLE public.promotor_pagbank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagbank_ver_propria" ON public.promotor_pagbank_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pagbank_inserir_propria" ON public.promotor_pagbank_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pagbank_atualizar_propria" ON public.promotor_pagbank_accounts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "pagbank_deletar_propria" ON public.promotor_pagbank_accounts
  FOR DELETE USING (auth.uid() = user_id);
