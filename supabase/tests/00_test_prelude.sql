-- Doar pentru containerul de test (supabase/postgres): aduce storage.buckets
-- la schema actuală din Supabase Cloud și definește utilitare de test.
alter table storage.buckets add column if not exists public boolean default false;
alter table storage.buckets add column if not exists file_size_limit bigint;
alter table storage.buckets add column if not exists allowed_mime_types text[];

create schema if not exists test;
grant usage on schema test to authenticated, anon;

-- Rulează SQL ca rolul curent și cere să eșueze cu un mesaj care conține p_expect.
create function test.expect_error(p_sql text, p_expect text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(lower(p_expect) in lower(sqlerrm)) = 0 then
      raise exception 'FAIL: eroare neașteptată pentru [%]: % (așteptat: %)', p_sql, sqlerrm, p_expect;
    end if;
    return;
  end;
  raise exception 'FAIL: trebuia să eșueze: %', p_sql;
end $$;

create function test.eq(p_actual anyelement, p_expected anyelement, p_what text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL: % — obținut %, așteptat %', p_what, p_actual, p_expected;
  end if;
  raise notice 'ok  %', p_what;
end $$;

create function test.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, false)
$$;

grant execute on all functions in schema test to authenticated, anon;

alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, anon;
grant select, insert on storage.objects to authenticated;
