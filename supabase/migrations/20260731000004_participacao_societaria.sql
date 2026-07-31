-- Participação societária em organization_admins: distingue proprietário
-- integral de sócio (não muda permissão nenhuma, é só representação).
-- Um mesmo dono pode ser integral numa organização e sócio em outra
-- (ex: mesma marca "Caldeirão" em cidades diferentes, donos diferentes).
alter table organization_admins
  add column if not exists participacao text not null default 'integral'
    check (participacao in ('integral', 'socio'));
