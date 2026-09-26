-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet v3 — 90: timp real prin LISTEN/NOTIFY
--
-- Fiecare modificare a unui tabel din publicația supabase_realtime trimite pe
-- canalul `optifleet_changes` doar tabelul, operația și câteva id-uri. Serverul
-- Next.js recitește rândul CA FIECARE UTILIZATOR conectat (prin RLS) și îl
-- trimite doar celor care au voie să-l vadă.
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists platform;

create or replace function platform.notify_change() returns trigger
language plpgsql as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
begin
  perform pg_notify('optifleet_changes', jsonb_build_object(
    't', tg_table_name,
    'op', tg_op,
    'row', jsonb_strip_nulls(jsonb_build_object(
      'id', r -> 'id',
      'company_id', r -> 'company_id',
      'vehicle_id', r -> 'vehicle_id',
      'booking_id', r -> 'booking_id'))
  )::text);
  return null;
end $$;

do $$
declare
  t record;
begin
  for t in
    select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime'
  loop
    execute format('drop trigger if exists optifleet_notify on %I.%I', t.schemaname, t.tablename);
    execute format('create trigger optifleet_notify after insert or update or delete on %I.%I
                    for each row execute function platform.notify_change()', t.schemaname, t.tablename);
  end loop;
end $$;
