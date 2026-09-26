-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet v2 — 09: view-uri pentru client (lat/lon în loc de WKB)
-- security_invoker = true → RLS-ul tabelelor de bază se aplică apelantului.
-- ═══════════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

create view public.vehicles_map with (security_invoker = true) as
select v.id, v.company_id, c.name as company_name, v.plate, v.make_model, v.body_type,
       v.cargo_length_cm, v.cargo_width_cm, v.cargo_height_cm, v.max_payload_kg, v.pallet_capacity,
       v.has_reefer, v.price_per_km, v.gps_device_id, v.gps_protocol, v.status, v.is_listed,
       v.district_id, v.speed_kmh, v.heading, v.position_at,
       ST_Y(v.position::geometry) as lat, ST_X(v.position::geometry) as lon,
       v.trip_origin_id, v.trip_destination_id, v.trip_departure_at, v.trip_distance_km, v.trip_duration_min,
       v.occupied_pallets, v.occupied_weight_kg, v.booked_pallets, v.booked_weight_kg, v.free_pallets,
       v.updated_at
from public.vehicles v
join public.companies c on c.id = v.company_id;

create view public.freight_requests_geo with (security_invoker = true) as
select r.*,
       ST_Y(r.origin_point::geometry) as origin_lat, ST_X(r.origin_point::geometry) as origin_lon,
       ST_Y(r.destination_point::geometry) as destination_lat, ST_X(r.destination_point::geometry) as destination_lon,
       c.name as company_name
from public.freight_requests r
join public.companies c on c.id = r.company_id;

grant select on public.vehicles_map, public.freight_requests_geo to authenticated;

-- Traseul planificat al unui vehicul vizibil apelantului (GeoJSON LineString).
create function public.vehicle_route(p_vehicle uuid) returns jsonb
language sql stable set search_path = public, extensions, pg_temp as $$
  select ST_AsGeoJSON(trip_route, 5)::jsonb from public.vehicles where id = p_vehicle and trip_route is not null
$$;
revoke execute on function public.vehicle_route(uuid) from public, anon;
grant execute on function public.vehicle_route(uuid) to authenticated;
