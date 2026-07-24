-- View agregada de pedidos aprovados por usuário.
-- Usada no painel admin (/admin/usuarios) para não precisar puxar todos os
-- pedidos e somar em JavaScript a cada carregamento da página — o Postgres
-- já entrega o total pronto.
create or replace view public.user_order_stats as
select
  user_id,
  count(*)::int as qtd_compras,
  sum(total)     as total_gasto
from public.orders
where status = 'approved' and user_id is not null
group by user_id;

-- Índice de apoio: acelera tanto a agregação acima quanto qualquer busca
-- de pedidos por usuário + status (ex: "pedidos aprovados do usuário X").
create index if not exists idx_orders_user_id_status on public.orders(user_id, status);
