-- Tabela para guardar as credenciais OAuth do Mercado Pago de cada promotor.
-- O promotor conecta sua conta MP via OAuth; a Tipo7 usa as credenciais dele
-- para criar pagamentos e recebe uma taxa (marketplace_fee / application_fee).
CREATE TABLE IF NOT EXISTS public.promotor_mp_accounts (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mp_user_id       BIGINT      NOT NULL,
  mp_access_token  TEXT        NOT NULL,
  mp_refresh_token TEXT,
  mp_public_key    TEXT,
  fee_pct          NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id)
);

ALTER TABLE public.promotor_mp_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_ver_propria" ON public.promotor_mp_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mp_inserir_propria" ON public.promotor_mp_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mp_atualizar_propria" ON public.promotor_mp_accounts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "mp_deletar_propria" ON public.promotor_mp_accounts
  FOR DELETE USING (auth.uid() = user_id);
