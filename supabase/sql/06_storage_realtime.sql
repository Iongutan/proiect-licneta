-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet v2 — 06: stocare privată (dovezi foto K11) + Realtime (K5/K10)
-- ═══════════════════════════════════════════════════════════════════════════

-- Bucket PRIVAT: fișierele se citesc doar prin URL-uri semnate, de părțile
-- rezervării. Maxim 8 MB, doar imagini.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('delivery-proofs', 'delivery-proofs', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Calea obiectului: <booking_id>/<uuid>.<ext>
create policy delivery_proofs_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'delivery-proofs'
  and (storage.foldername(name))[1] in (
    select b.id::text from public.bookings b
    where b.carrier_company_id = (select public.current_company_id())
      and b.status in ('CONTRACTED', 'IN_TRANSIT')
  )
);

create policy delivery_proofs_read on storage.objects for select to authenticated using (
  bucket_id = 'delivery-proofs'
  and (storage.foldername(name))[1] in (
    select b.id::text from public.bookings b
    where (select public.current_company_id()) in (b.shipper_company_id, b.carrier_company_id)
  )
);
-- Fără politici de UPDATE/DELETE: dovada nu poate fi înlocuită sau ștearsă de client.

-- ─── Realtime: schimbările respectă RLS ───────────────────────────────────
alter publication supabase_realtime add table
  public.vehicles, public.vehicle_loads, public.bookings, public.booking_messages, public.notifications;
