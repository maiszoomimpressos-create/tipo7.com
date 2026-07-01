-- Permite leitura pública de dias e atrações de eventos publicados
create policy "public reads published event_days"
  on public.event_days for select
  using (
    event_id in (select id from public.events where status = 'publicado')
  );

create policy "public reads published event_day_attractions"
  on public.event_day_attractions for select
  using (
    event_day_id in (
      select d.id from public.event_days d
      join public.events e on e.id = d.event_id
      where e.status = 'publicado'
    )
  );
