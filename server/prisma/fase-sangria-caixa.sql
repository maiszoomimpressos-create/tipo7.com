-- Sangria de caixa (20/08/2026) — ver project_token_pin_acesso_caixa na memória.

CREATE TABLE IF NOT EXISTS public.caixa_sangrias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caixa_id uuid NOT NULL REFERENCES public.caixas(id),
  valor numeric(10,2) NOT NULL,
  motivo text,
  retirado_por_user_id uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_caixa_sangrias_caixa_id ON public.caixa_sangrias (caixa_id);

ALTER TYPE public.event_permission ADD VALUE IF NOT EXISTS 'autorizar_sangria';
