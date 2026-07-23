-- Nova permissão de cargo: operar o módulo de estacionamento de um evento.
-- Precisa de migration própria: ALTER TYPE ... ADD VALUE não pode rodar na mesma
-- transação que código que já usa o novo valor (mesmo padrão de 20260706000003).
ALTER TYPE public.event_permission ADD VALUE IF NOT EXISTS 'gerenciar_estacionamento';
