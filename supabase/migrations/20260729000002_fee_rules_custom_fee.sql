-- Regras de evento específico deixam de ser só um desconto percentual (discount_pct)
-- e passam a poder definir uma taxa inteira própria pro evento (fixo ou %, + 2 taxas
-- específicas), igual à config geral de Financeiro > Tarifas. discount_pct continua
-- existindo e sendo usado por promoter_quota/global_quota, sem mudança.
ALTER TABLE public.fee_rules
  ADD COLUMN IF NOT EXISTS fee_type          TEXT CHECK (fee_type IN ('fixed','percent')),
  ADD COLUMN IF NOT EXISTS fee_value         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS extra_fee_1_label TEXT,
  ADD COLUMN IF NOT EXISTS extra_fee_1_value NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS extra_fee_1_type  TEXT CHECK (extra_fee_1_type IN ('fixed','percent')),
  ADD COLUMN IF NOT EXISTS extra_fee_2_label TEXT,
  ADD COLUMN IF NOT EXISTS extra_fee_2_value NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS extra_fee_2_type  TEXT CHECK (extra_fee_2_type IN ('fixed','percent'));
