-- Percentual de participação societária — só faz sentido perguntar pra
-- sócio (proprietário integral é sempre 100% por definição). Guardado só
-- pra referência hoje, prepara terreno pra funcionalidades futuras
-- (divisão de repasse, relatórios por sócio, etc.) — nenhuma lógica de
-- dinheiro lê essa coluna ainda.
alter table organization_admins
  add column if not exists percentual numeric(5,2)
    check (percentual is null or (percentual > 0 and percentual <= 100));

-- Backfill: quem já é integral (o próprio dono/backfill anterior) fica 100%.
update organization_admins set percentual = 100 where participacao = 'integral' and percentual is null;
