-- Pedidos gerados no checkout
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete set null,
  event_id         uuid references public.events(id) on delete cascade not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected', 'cancelled', 'in_process')),
  total            numeric(10,2) not null default 0,
  mp_preference_id text,
  mp_payment_id    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Itens de cada pedido (um ingresso × quantidade)
create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references public.orders(id) on delete cascade not null,
  ticket_id    uuid references public.event_tickets(id) on delete set null,
  quantity     int not null check (quantity > 0),
  unit_price   numeric(10,2) not null,
  created_at   timestamptz not null default now()
);

alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Usuário vê apenas seus próprios pedidos
create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);

-- Itens visíveis ao dono do pedido
create policy "order_items_select_own" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );
