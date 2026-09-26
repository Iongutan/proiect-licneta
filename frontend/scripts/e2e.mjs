#!/usr/bin/env node
// Test E2E pe aplicația locală pornită (npm run dev), într-un browser real.
// Fiecare rulare creează conturi noi (sufix unic), deci se poate repeta.
//
//   npm run e2e                       (Chrome instalat pe calculator)
//   OPTIFLEET_CHROME=/cale/chrome npm run e2e
//
// Pași: înregistrare transportator + expeditor + admin → verificare KYC →
// transportatorul adaugă un vagon de tren și o dronă din constructorul unic,
// declară locurile ocupate ale vagonului → expeditorul găsește vagonul pe hartă
// și cere locuri → transportatorul primește notificarea în timp real.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const BASE = process.env.OPTIFLEET_URL ?? "http://127.0.0.1:3000";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = process.env.OPTIFLEET_SHOTS ?? path.join(HERE, "..", "..", ".data", "e2e");
const run = Date.now().toString().slice(-7);
const PASSWORD = "Parola-test-2026";
fs.mkdirSync(SHOTS, { recursive: true });

let step = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
async function shot(page, name) {
  step += 1;
  await page.screenshot({ path: path.join(SHOTS, `${String(step).padStart(2, "0")}-${name}.png`), fullPage: true });
}

function launchOptions() {
  if (process.env.OPTIFLEET_CHROME) return { executablePath: process.env.OPTIFLEET_CHROME };
  const bundled = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  if (fs.existsSync(bundled)) return { executablePath: bundled };
  return { channel: process.platform === "win32" ? "msedge" : "chrome" };
}

async function register(browser, { kind, company, email, idno, district, name }) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, locale: "ro-MD" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/register`);
  await page.getByText(kind, { exact: true }).click();
  await page.getByLabel("Denumirea firmei").fill(company);
  await page.getByLabel("IDNO").fill(idno);
  await page.getByLabel("Raionul sediului").selectOption(district);
  await page.getByLabel("Numele tău").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parolă").fill(PASSWORD);
  await page.locator("input[type=checkbox]").last().check();
  await page.getByRole("button", { name: /Creează|Înregistr/ }).click();
  await page.waitForURL(/\/map/, { timeout: 30_000 });
  ok(`înregistrat ${company} (${email})`);
  return page;
}

const browser = await chromium.launch(launchOptions());
try {
  console.log(`E2E pe ${BASE} (rulare ${run})`);
  const carrierEmail = `transport${run}@test.md`;
  const shipperEmail = `marfa${run}@test.md`;
  const adminEmail = `admin${run}@test.md`;

  const carrier = await register(browser, {
    kind: "Sunt transportator", company: `Trans ${run}`, email: carrierEmail, idno: `100${run}001`, district: "ungheni", name: "Ion Transportator",
  });
  const shipper = await register(browser, {
    kind: "Am marfă de transportat", company: `Producător ${run}`, email: shipperEmail, idno: `100${run}002`, district: "chisinau", name: "Ana Producător",
  });
  const admin = await register(browser, {
    kind: "Am marfă de transportat", company: `Admin ${run}`, email: adminEmail, idno: `100${run}003`, district: "chisinau", name: "Admin Platformă",
  });
  execFileSync(process.execPath, [path.join(HERE, "optifleet.mjs"), "admin", adminEmail], { stdio: "inherit" });

  // ─── Admin: verificare KYC ────────────────────────────────────────────
  await admin.goto(`${BASE}/admin`);
  for (const company of [`Trans ${run}`, `Producător ${run}`]) {
    const row = admin.locator("tr", { hasText: company });
    await row.getByRole("button", { name: "Verifică" }).click();
    await admin.locator("tr", { hasText: company }).getByRole("button", { name: "Verifică" }).waitFor({ state: "detached" });
  }
  await shot(admin, "admin-kyc");
  ok("adminul a verificat ambele firme");

  // ─── Transportator: vagon de tren din constructorul unic ─────────────
  await carrier.goto(`${BASE}/fleet`);
  await carrier.getByRole("button", { name: "Adaugă în flotă" }).click();
  await carrier.getByLabel("Ce adaugi?").fill("vagon de tren");
  await shot(carrier, "constructor-vagon");
  await carrier.getByRole("button", { name: "Continuă" }).click();
  await carrier.getByLabel("Număr vagon").fill(`31 53 ${run.slice(0, 4)} 555-1`);
  await carrier.getByLabel("Marcă și model").fill("Vagon acoperit Habbins");
  await carrier.getByLabel("Deținere").selectOption("RENTED");
  await carrier.getByRole("button", { name: "Continuă" }).click();
  await carrier.getByRole("button", { name: "Continuă" }).click();
  await carrier.getByLabel("Tracker GPS").selectOption("MANUAL");
  await carrier.getByRole("button", { name: "Adaugă în flotă" }).last().click();
  await carrier.waitForURL(/\/fleet\/[0-9a-f-]{36}/);
  await carrier.getByLabel("Ocupate (paleți)").fill("38");
  await carrier.getByLabel("Greutatea lor (kg)").fill("22800");
  await carrier.getByRole("button", { name: "Salvează", exact: true }).click();
  await carrier.getByText("12 paleți libere apar acum în bursă").waitFor();
  await shot(carrier, "vagon-locuri");
  ok("vagon adăugat, 38/50 ocupate → 12 libere");

  // ─── Transportator: dronă cu zonă de raioane ─────────────────────────
  await carrier.goto(`${BASE}/fleet`);
  await carrier.getByRole("button", { name: "Adaugă în flotă" }).click();
  await carrier.getByLabel("Ce adaugi?").fill("dronă");
  await carrier.getByRole("button", { name: "Continuă" }).click();
  await carrier.getByLabel("Serie / nr. înregistrare").fill(`UAS ${run}`);
  await carrier.getByLabel("Marcă și model").fill("DJI FlyCart 30");
  await carrier.getByRole("button", { name: "Continuă" }).click();
  await carrier.getByRole("button", { name: "Chișinău", exact: true }).click();
  await carrier.getByRole("button", { name: "Continuă" }).click();
  await carrier.getByLabel("Tracker GPS").selectOption("MANUAL");
  await carrier.getByRole("button", { name: "Adaugă în flotă" }).last().click();
  await carrier.waitForURL(/\/fleet\/[0-9a-f-]{36}/);
  await carrier.getByText("Zona deservită").first().waitFor();
  await carrier.goto(`${BASE}/fleet`);
  await carrier.locator(".kbd-plate", { hasText: `UAS ${run}` }).waitFor();
  await shot(carrier, "flota-multimodala");
  ok("dronă adăugată; flota are vagon + dronă");

  // ─── Expeditor: găsește vagonul și cere locuri ───────────────────────
  await shipper.goto(`${BASE}/map`);
  await shipper.getByLabel("Caută o cursă").fill("Ungheni Chișinău 3 paleți");
  await shipper.getByLabel("Caută o cursă").press("Enter");
  await shipper.getByRole("button", { name: new RegExp(`31 53 ${run.slice(0, 4)}`) }).first().click();
  await shipper.getByRole("button", { name: "Cere locuri" }).click();
  await shot(shipper, "cerere-locuri");
  const bellBefore = await carrier.getByRole("button", { name: /^Notificări/ }).getAttribute("aria-label");
  await shipper.getByRole("button", { name: /Trimite/ }).click();
  await shipper.getByText("Cererea a fost trimisă").waitFor();
  ok("expeditorul a trimis cererea de locuri pe vagon");

  // ─── Timp real: notificarea ajunge fără reîncărcarea paginii ─────────
  await carrier.getByRole("button", { name: /Notificări \(\d+ necitite\)/ }).waitFor({ timeout: 15_000 });
  const bellAfter = await carrier.getByRole("button", { name: /^Notificări/ }).getAttribute("aria-label");
  await shot(carrier, "notificare-live");
  ok(`notificare în timp real („${bellBefore}” → „${bellAfter}”)`);

  console.log(`\nTOATE PAȘII AU TRECUT. Capturi: ${SHOTS}`);
} catch (err) {
  console.error("\nE2E EȘUAT:", err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
