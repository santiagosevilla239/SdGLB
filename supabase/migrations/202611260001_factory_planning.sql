-- Planning stores only minima, ingredients, purchases and their movements.
create table public.factory_planning (
  id boolean primary key default true check (id),
  version integer not null default 0,
  state jsonb not null default '{"ingredients":[],"purchases":[],"movements":[],"minimums":{},"commands":[]}'::jsonb
);

insert into public.factory_planning (id) values (true);

alter table public.factory_planning enable row level security;
revoke all on public.factory_planning from public, anon, authenticated;
grant select on public.factory_planning to authenticated;
grant update (state, version) on public.factory_planning to authenticated;

create policy "Factory admins read planning"
on public.factory_planning for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and role::text = 'admin'));

create policy "Factory admins edit planning"
on public.factory_planning for update to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and role::text = 'admin'))
with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role::text = 'admin'));

-- Count directly in the operational inventory. Never maintain a second tub balance.
create function public.factory_planning_stock()
returns table (flavor_id integer, available bigint)
language sql stable security invoker set search_path = ''
as $$
  select t.flavor_id, count(*)
  from public.tubs t
  -- The base app stores factory tubs with no branch assigned.
  where t.branch_id is null and t.status = 'in_stock'
    and exists (select 1 from public.profiles where id = (select auth.uid()) and role::text = 'admin')
  group by t.flavor_id;
$$;

revoke all on function public.factory_planning_stock() from public, anon;
grant execute on function public.factory_planning_stock() to authenticated;
