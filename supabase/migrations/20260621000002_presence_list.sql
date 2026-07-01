-- Lista de presença configurável por evento
-- O promotor escolhe quais campos quer coletar (nome, telefone, email)
-- Qualquer pessoa com o QR code pode se adicionar à lista (sem login)

-- Configuração da lista de presença por evento (1 por evento)
create table public.event_presence_config (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid references public.events(id) on delete cascade not null unique,
  enabled        boolean not null default false,
  field_nome     boolean not null default true,
  field_telefone boolean not null default false,
  field_email    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Entradas da lista — uma linha por pessoa que se cadastrou
create table public.presence_entries (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid references public.events(id) on delete cascade not null,
  full_name  text,
  phone      text,
  email      text,
  created_at timestamptz not null default now()
);

alter table public.event_presence_config enable row level security;
alter table public.presence_entries        enable row level security;

-- Leitura pública da config (a página de presença precisa saber os campos)
create policy "presence_config_public_read" on public.event_presence_config
  for select using (true);

-- Apenas o dono do evento gerencia a configuração
create policy "presence_config_owner_all" on public.event_presence_config
  for all using (
    exists (
      select 1 from public.events e
      where e.id = event_presence_config.event_id
        and e.created_by = auth.uid()
    )
  );

-- Qualquer um pode se adicionar à lista (sem login)
create policy "presence_entries_public_insert" on public.presence_entries
  for insert with check (true);

-- Apenas o dono do evento vê a lista de quem se cadastrou
create policy "presence_entries_owner_read" on public.presence_entries
  for select using (
    exists (
      select 1 from public.events e
      where e.id = presence_entries.event_id
        and e.created_by = auth.uid()
    )
  );
