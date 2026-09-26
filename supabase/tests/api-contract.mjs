// Test de contract frontend ↔ API: aceleași apeluri PostgREST/RPC pe care le face
// interfața, rulate ca utilizatori reali (JWT), peste schema v2.
// Rulare: bash supabase/tests/api-contract.sh
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";

// Dependența vine din frontend/node_modules (același client ca în aplicație).
const require = createRequire(new URL("../../frontend/package.json", import.meta.url));
const { PostgrestClient } = require("@supabase/postgrest-js");

const API_URL = process.env.PGRST_URL ?? "http://127.0.0.1:55433";
const SECRET = process.env.JWT_SECRET;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(sub) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ sub, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
const as = (sub) => new PostgrestClient(API_URL, { headers: { Authorization: `Bearer ${jwt(sub)}` } });

let failures = 0;
function check(ok, label, extra) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${!ok && extra ? ` — ${JSON.stringify(extra)}` : ""}`);
  if (!ok) failures++;
}
const must = (res, label) => {
  check(!res.error, label, res.error);
  return res.data;
};

const S = "11111111-1111-4111-8111-111111111111";
const C = "33333333-3333-4333-8333-333333333333";
const A = "55555555-5555-4555-8555-555555555555";
const shipper = as(S), carrier = as(C), admin = as(A);

// Profil + companie (getViewer)
const profile = must(await carrier.from("profiles").select("id, company_id, full_name, company_role").eq("id", C).maybeSingle(), "profiles: citire profil propriu");
const shipperProfile = must(await shipper.from("profiles").select("company_id").eq("id", S).maybeSingle(), "profiles: expeditor");
must(await admin.from("platform_admins").select("user_id").eq("user_id", A).maybeSingle(), "platform_admins: rândul propriu");

// KYC (AdminPanel)
for (const p of [profile, shipperProfile]) must(await admin.rpc("review_company", { p_company: p.company_id, p_status: "VERIFIED", p_note: null }), "review_company");
must(await admin.rpc("refresh_demo_trips"), "refresh_demo_trips");

// K6: vehicul nou (VehicleWizard)
const veh = must(await carrier.from("vehicles").insert({
  company_id: profile.company_id, plate: "API 777", make_model: "DAF XF", body_type: "CURTAINSIDE",
  cargo_length_cm: 1360, cargo_width_cm: 245, cargo_height_cm: 270, max_payload_kg: 24000, pallet_capacity: 33,
  has_reefer: false, price_per_km: 19, gps_protocol: "TELTONIKA", gps_device_id: "FMB920-1", district_id: "chisinau",
  position: "SRID=4326;POINT(28.8638 47.0105)", position_at: new Date().toISOString(),
}).select("id").single(), "vehicles.insert cu poziție EWKT");
must(await carrier.from("vehicle_private").insert({ vehicle_id: veh.id, driver_name: "Ion", driver_phone: "+373 69 111 222" }), "vehicle_private.insert");

// K7: plan de încărcare (VehicleDetail.save)
const items = Array.from({ length: 10 }, (_, k) => ({ x_cm: Math.floor(k / 3) * 120, y_cm: (k % 3) * 80, length_cm: 120, width_cm: 80, format: "EUR", weight_kg: 500, booking_id: null, label: k === 0 ? "vin" : null }));
must(await carrier.rpc("save_vehicle_layout", { p_vehicle: veh.id, p_items: items }), "save_vehicle_layout");
const mapRow = must(await carrier.from("vehicles_map").select("*").eq("id", veh.id).maybeSingle(), "vehicles_map");
check(mapRow?.free_pallets === 23 && mapRow?.lat > 47 && mapRow?.company_name, "vehicles_map: lat/lon + locuri libere + firmă", mapRow);

// Cursa (TripPlanner) cu GeoJSON ca de la OSRM
const route = { type: "LineString", coordinates: [[28.8638, 47.0105], [28.8231, 47.3831], [28.7969, 47.8161], [28.9622, 47.7492]] };
must(await carrier.rpc("set_vehicle_trip", { p_vehicle: veh.id, p_origin: "chisinau", p_destination: "rezina", p_departure: new Date(Date.now() + 3600e3).toISOString(), p_route: route, p_distance_km: 120.5, p_duration_min: 110 }), "set_vehicle_trip cu GeoJSON");
check((await carrier.rpc("vehicle_route", { p_vehicle: veh.id })).data?.type === "LineString", "vehicle_route");

// Poziție manuală (GpsPanel)
must(await carrier.from("vehicles").update({ position: "SRID=4326;POINT(28.82 47.38)", district_id: "orhei", position_at: new Date().toISOString(), speed_kmh: 0 }).eq("id", veh.id), "vehicles.update poziție manuală");
const token = must(await carrier.rpc("issue_device_token", { p_vehicle: veh.id }), "issue_device_token");
check(/^[0-9a-f]{64}$/.test(token ?? ""), "token GPS de 64 hex");

// Expeditor: cerere nouă (NewRequestForm)
const req = must(await shipper.from("freight_requests").insert({
  company_id: shipperProfile.company_id, origin_district_id: "chisinau", origin_address: "str. Test 1",
  origin_point: "SRID=4326;POINT(28.85 47.02)", destination_district_id: "soroca", destination_address: null,
  destination_point: "SRID=4326;POINT(28.2975 48.1558)", pallets: 3, pallet_format: "EUR", weight_kg: 1500,
  body_type: null, needs_reefer: false, vehicles_needed: 1, ready_from: new Date(Date.now() + 3600e3).toISOString(),
  deliver_by: new Date(Date.now() + 86400e3).toISOString(), cargo_description: "test", budget_mdl: 2500,
}).select("id").single(), "freight_requests.insert cu puncte EWKT");
must(await carrier.from("freight_requests_geo").select("*").eq("status", "OPEN").neq("company_id", profile.company_id), "freight_requests_geo (bursa)");

// K4 (MapScreen)
const found = must(await shipper.rpc("search_trips", { p_origin: "chisinau", p_destination: "soldanesti", p_min_free: 3, p_with_transit: true, p_body_type: null, p_corridor_km: 15 }), "search_trips");
check(found?.some((r) => r.plate === "API 777" && r.match_type === "TRANSIT" && r.eta_origin), "K4: vehiculul nou apare în tranzit, cu oră", found?.map((r) => [r.plate, r.match_type]));
must(await shipper.rpc("vehicles_passing_near_me", { p_radius_km: 15, p_min_free: 1 }), "vehicles_passing_near_me");

// K8: cerere de paleți (VehicleDrawer) + ofertă pe cerere (OfferDialog)
const bookingId = must(await shipper.rpc("propose_booking", { p_vehicle: veh.id, p_pallets: 3, p_weight_kg: 1500, p_pickup: "chisinau", p_dropoff: "soldanesti", p_pickup_at: new Date(Date.now() + 7200e3).toISOString(), p_price: null, p_request: req.id, p_message: "Salut" }), "propose_booking (expeditor)");
const demoVehicle = must(await carrier.from("vehicles_map").select("id").eq("company_id", profile.company_id).eq("plate", "API 777").single(), "vehicul propriu");
check(Boolean(demoVehicle), "carrier vede vehiculul propriu");
const notif = must(await carrier.from("notifications").select("id, kind, title, body, link, read_at, created_at").order("created_at", { ascending: false }).limit(20), "notifications");
check(notif?.some((n) => n.link === `/bookings/${bookingId}`), "notificare cu link către negociere");
must(await carrier.rpc("mark_notifications_read"), "mark_notifications_read");

// Negociere (Thread) + contract (K9)
must(await carrier.from("booking_messages").insert({ booking_id: bookingId, sender_company_id: profile.company_id, body: "Propun 1800 MDL", price_mdl: 1800 }), "booking_messages.insert cu preț");
must(await shipper.rpc("accept_price", { p_booking: bookingId }), "accept_price");
const hash = must(await shipper.rpc("choose_contract_path", { p_booking: bookingId, p_path: "PLATFORM" }), "choose_contract_path PLATFORM");
check(/^[0-9a-f]{64}$/.test(hash ?? ""), "hash SHA-256 întors");
must(await shipper.rpc("sign_booking", { p_booking: bookingId, p_disclaimer_accepted: false }), "sign_booking expeditor");
const st = must(await carrier.rpc("sign_booking", { p_booking: bookingId, p_disclaimer_accepted: false }), "sign_booking transportator");
check(st === "CONTRACTED", "contract activ", st);
const drv = must(await shipper.from("vehicle_private").select("driver_name, driver_phone").eq("vehicle_id", veh.id).maybeSingle(), "vehicle_private vizibil expeditorului după contract");
check(drv?.driver_phone === "+373 69 111 222", "telefon șofer vizibil contrapărții");

// Plasarea paleților rezervați pe plan (VehicleDetail, „rezervată: contract …”)
must(await carrier.rpc("save_vehicle_layout", { p_vehicle: veh.id, p_items: [...items, { x_cm: 480, y_cm: 0, length_cm: 120, width_cm: 80, format: "EUR", weight_kg: 500, booking_id: bookingId, label: null }] }), "save_vehicle_layout cu palet rezervat");
must(await carrier.rpc("start_transit", { p_booking: bookingId }), "start_transit");

// Lista de contracte (BookingsPage) + audit (BookingDetail)
must(await shipper.from("bookings").select("*").order("updated_at", { ascending: false }).limit(300), "bookings (listă)");
const audit = must(await shipper.from("audit_log").select("id, action, created_at, details").eq("entity", "booking").eq("entity_id", bookingId).order("created_at"), "audit_log pentru rezervare");
check(audit?.length >= 4, "jurnal cu pașii rezervării", audit?.map((a) => a.action));

// Anulare cerere (RequestsScreen) — trebuie refuzată: cererea e contractată
const cancel = await shipper.rpc("cancel_request", { p_request: req.id });
check(Boolean(cancel.error), "cancel_request refuzat pentru cerere contractată");

// Cont (AccountForm)
must(await shipper.from("companies").update({ name: "Expeditor Unu", address: "str. Nouă 5", phone: "+373 22 111 222", district_id: "chisinau", location: "SRID=4326;POINT(28.8638 47.0105)" }).eq("id", shipperProfile.company_id), "companies.update (coloane permise)");
const bad = await shipper.from("companies").update({ kyc_status: "VERIFIED" }).eq("id", shipperProfile.company_id);
check(Boolean(bad.error), "companies.update kyc_status refuzat");
must(await shipper.from("profiles").update({ full_name: "Ana E." }).eq("id", S), "profiles.update full_name");

console.log(failures ? `\n${failures} verificări au eșuat` : "\n══ CONTRACT API: TOATE VERIFICĂRILE AU TRECUT ══");
process.exit(failures ? 1 : 0);
