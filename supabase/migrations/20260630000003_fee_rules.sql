-- Regras de isenção e desconto de taxa da plataforma
-- Permite aplicar descontos por evento, por promotor (com quota) ou global
CREATE TABLE IF NOT EXISTS public.fee_rules (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT        NOT NULL,
  type            TEXT        NOT NULL CHECK (type IN ('event', 'promoter_quota', 'global_quota')),
  event_id        UUID        REFERENCES public.events(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 100 CHECK (discount_pct >= 0 AND discount_pct <= 100),
  quota_limit     INTEGER,
  quota_period    TEXT        CHECK (quota_period IN ('total', 'monthly')),
  bypass_minimum  BOOLEAN     NOT NULL DEFAULT false,
  active          BOOLEAN     NOT NULL DEFAULT true,
  notes           TEXT,
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.fee_rules ENABLE ROW LEVEL SECURITY;

-- Apenas service role acessa (admin usa service client)
CREATE POLICY "fee_rules_service_only" ON public.fee_rules USING (false);

-- Adiciona min_fee_pct ao platform_settings se ainda não existir
INSERT INTO public.platform_settings (key, value)
VALUES ('min_fee_pct', '0')
ON CONFLICT (key) DO NOTHING;
