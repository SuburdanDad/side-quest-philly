-- Fix: get_visitors() threw "function max(uuid) does not exist" for
-- real admins (Postgres has no max() aggregate for uuid). Pick the
-- latest non-null user_id via array_agg instead, and join auth.users
-- for the email. Anon callers were rejected before the bug executed,
-- which is why the anon-denial test didn't catch it.
create or replace function public.get_visitors(limit_count integer default 200)
returns table (
  anon_id uuid,
  first_seen timestamptz,
  last_seen timestamptz,
  first_src text,
  country text,
  device text,
  active_days integer,
  events integer,
  quest_starts integer,
  completes integer,
  verified integer,
  shares integer,
  email text
)
language plpgsql
security definer
set search_path = public
stable
as $fn$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
  with per_visitor as (
    select
      e.anon_id as v_anon_id,
      min(e.created_at) as v_first_seen,
      max(e.created_at) as v_last_seen,
      (array_agg(e.src order by e.created_at) filter (where e.src is not null))[1] as v_first_src,
      (array_agg(e.country order by e.created_at) filter (where e.country is not null))[1] as v_country,
      (array_agg(e.device order by e.created_at desc) filter (where e.device is not null))[1] as v_device,
      count(distinct e.created_at::date)::integer as v_active_days,
      count(*)::integer as v_events,
      (count(*) filter (where e.event = 'quest_start'))::integer as v_quest_starts,
      (count(*) filter (where e.event = 'objective_complete'))::integer as v_completes,
      (count(*) filter (where e.event = 'photo_verified'))::integer as v_verified,
      (count(*) filter (where e.event = 'share'))::integer as v_shares,
      (array_agg(e.user_id order by e.created_at desc) filter (where e.user_id is not null))[1] as v_user_id
    from quest_events e
    group by e.anon_id
  )
  select
    pv.v_anon_id,
    pv.v_first_seen,
    pv.v_last_seen,
    pv.v_first_src,
    pv.v_country,
    pv.v_device,
    pv.v_active_days,
    pv.v_events,
    pv.v_quest_starts,
    pv.v_completes,
    pv.v_verified,
    pv.v_shares,
    u.email::text
  from per_visitor pv
  left join auth.users u on u.id = pv.v_user_id
  order by pv.v_last_seen desc
  limit least(greatest(limit_count, 1), 1000);
end;
$fn$;
revoke all on function public.get_visitors(integer) from public;
grant execute on function public.get_visitors(integer) to authenticated;
