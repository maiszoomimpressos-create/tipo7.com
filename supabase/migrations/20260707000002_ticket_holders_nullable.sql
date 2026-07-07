-- Torna os campos de ticket_holders opcionais e adiciona telefone
-- Bilheteria coleta dados após pagamento — nem sempre tem todos os campos
ALTER TABLE public.ticket_holders
  ALTER COLUMN full_name  DROP NOT NULL,
  ALTER COLUMN cpf        DROP NOT NULL,
  ALTER COLUMN email      DROP NOT NULL,
  ALTER COLUMN birth_date DROP NOT NULL;

ALTER TABLE public.ticket_holders
  ADD COLUMN IF NOT EXISTS phone TEXT;
