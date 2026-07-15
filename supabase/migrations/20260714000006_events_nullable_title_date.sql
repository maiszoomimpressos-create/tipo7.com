-- Rascunhos de evento não precisam de título nem data logo na criação.
-- Esses campos se tornam obrigatórios apenas na etapa de publicação (validado no app).
ALTER TABLE public.events
  ALTER COLUMN title     DROP NOT NULL,
  ALTER COLUMN date_start DROP NOT NULL;
