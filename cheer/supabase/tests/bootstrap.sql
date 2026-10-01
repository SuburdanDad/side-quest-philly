-- Supabase shims for the DB tests (test/db/harness.ts loads this into a
-- throwaway database before the migrations).
--
-- Idempotent and non-destructive: on a plain Postgres it creates what Supabase
-- would provide; on the real supabase/postgres image, where all of this already
-- exists, it changes nothing (roles, schemas and auth functions are only
-- created when missing, never replaced).

-- Roles are cluster-wide and test files run in parallel, so tolerate a
-- concurrent creator winning the race.
do $$
declare
  v_role text;
begin
  foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_catalog.pg_roles where rolname = v_role) then
      begin
        execute format('create role %I nologin noinherit%s', v_role,
                       case when v_role = 'service_role' then ' bypassrls' else '' end);
      exception when duplicate_object or unique_violation then
        null;
      end;
    end if;
  end loop;
end;
$$;

create schema if not exists auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Supabase's own definitions (auth.uid() verbatim per docs/backend-spec.md §10).
do $$
begin
  if to_regprocedure('auth.uid()') is null then
    create function auth.uid() returns uuid language sql stable as $f$
      select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
      )::uuid
    $f$;
  end if;
  if to_regprocedure('auth.role()') is null then
    create function auth.role() returns text language sql stable as $f$
      select coalesce(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
      )::text
    $f$;
  end if;
  if to_regprocedure('auth.jwt()') is null then
    create function auth.jwt() returns jsonb language sql stable as $f$
      select coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
      )::jsonb
    $f$;
  end if;
end;
$$;

-- Supabase grants these to the API roles; grants only ever add.
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
