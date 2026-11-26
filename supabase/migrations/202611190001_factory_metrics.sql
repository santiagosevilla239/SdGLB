-- Install in a test database first. Captures events from the existing screens.
create table public.factory_metric_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('opening','dispatch')),
  happened_at timestamptz not null,
  branch_id text not null,
  flavor_id text not null,
  tub_id text not null,
  order_id text,
  unique (kind, tub_id)
);
create index factory_metric_events_date_idx on public.factory_metric_events (happened_at, id);
alter table public.factory_metric_events enable row level security;
revoke all on public.factory_metric_events from anon, authenticated;
grant select on public.factory_metric_events to authenticated;
create policy factory_metric_admin_read on public.factory_metric_events for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create function public.capture_factory_metric_opening() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status is distinct from new.status and new.status = 'opened' and new.branch_id is not null then
    insert into public.factory_metric_events (kind, happened_at, branch_id, flavor_id, tub_id)
    values ('opening', statement_timestamp(), new.branch_id::text, new.flavor_id::text, new.id::text)
    on conflict (kind,tub_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger factory_metric_opening after update of status on public.tubs
for each row execute function public.capture_factory_metric_opening();

create function public.capture_factory_metric_dispatch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.branch_id is null and new.branch_id is not null and new.order_id is not null then
    insert into public.factory_metric_events (kind, happened_at, branch_id, flavor_id, tub_id, order_id)
    select 'dispatch', o.delivery_date, new.branch_id::text, new.flavor_id::text, new.id::text, o.id::text
    from public.orders o where o.id = new.order_id
      and o.branch_id = new.branch_id and o.status in ('entregado','despachado') and o.delivery_date is not null
    on conflict (kind,tub_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger factory_metric_dispatch after update of branch_id on public.tubs
for each row execute function public.capture_factory_metric_dispatch();
