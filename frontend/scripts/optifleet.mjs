#!/usr/bin/env node
// OptiFleet local — fără Docker, fără servicii externe.
//
// Pornește PostgreSQL + PostGIS ca proces-copil al acestui script, aplică
// schema, apoi pornește Next.js. La oprire (Ctrl+C, Stop din VS Code, închiderea
// terminalului) se opresc amândouă. Datele stau în .data/ (în afara git).
//
// Comenzi (din rădăcina proiectului: npm run <comandă>):
//   dev            baza de date + Next.js în mod dezvoltare (implicit, F5)
//   start          baza de date + Next.js în mod producție (după `build`)
//   db             doar baza de date (pentru pgAdmin / teste)
//   setup          pregătește runtime-ul și baza (rulat automat de dev/start)
//   stop           oprește o bază rămasă pornită
//   status         arată dacă baza rulează și unde sunt datele
//   admin <email>  face contul administrator al platformei
//   backup         copie de siguranță în .data/backups
//   test-db        testele SQL (supabase/tests) pe o bază separată, optifleet_test
//   reset --yes    ȘTERGE baza locală și o recreează de la zero

import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(FRONTEND, "..");
const DATA = path.join(ROOT, ".data");
const PGDATA = path.join(DATA, "pg");
const CREDENTIALS = path.join(DATA, "credentials.json");
const RUNTIME = path.join(ROOT, ".runtime");
const IS_WINDOWS = process.platform === "win32";
const EXE = IS_WINDOWS ? ".exe" : "";
const DB_NAME = "optifleet";

const DOWNLOADS = {
  postgres: "https://get.enterprisedb.com/postgresql/postgresql-17.6-1-windows-x64-binaries.zip",
  postgis: "https://download.osgeo.org/postgis/windows/pg17/postgis-bundle-pg17-3.6.2x64.zip",
};

// Ordinea contează: platforma, schema aplicației (fără 00_reset și fără date demo), realtime.
const MIGRATIONS = [
  "db/platform/00_platform.sql",
  "supabase/sql/01_extensions.sql",
  "supabase/sql/02_tables.sql",
  "supabase/sql/03_functions_core.sql",
  "supabase/sql/04_rls_and_grants.sql",
  "supabase/sql/05_business_rpc.sql",
  "supabase/sql/06_storage_realtime.sql",
  "supabase/sql/07_seed_districts.sql",
  "supabase/sql/09_views.sql",
  "supabase/sql/10_trust_and_market.sql",
  "db/platform/90_realtime.sql",
];

const log = (msg) => console.log(`[optifleet] ${msg}`);
const fail = (msg) => {
  console.error(`\n[optifleet] ${msg}\n`);
  process.exit(1);
};

// ─── Găsirea binarelor PostgreSQL ─────────────────────────────────────────
function candidateBinDirs() {
  const dirs = [];
  if (process.env.OPTIFLEET_PG_BIN) dirs.push(process.env.OPTIFLEET_PG_BIN);
  dirs.push(path.join(RUNTIME, "pgsql", "bin"));
  if (process.platform === "linux") {
    const base = "/usr/lib/postgresql";
    if (fs.existsSync(base)) {
      for (const v of fs.readdirSync(base).sort((a, b) => Number(b) - Number(a))) dirs.push(path.join(base, v, "bin"));
    }
  }
  if (process.platform === "darwin") {
    for (const v of ["17", "16"]) {
      dirs.push(`/opt/homebrew/opt/postgresql@${v}/bin`, `/usr/local/opt/postgresql@${v}/bin`);
    }
    dirs.push("/Applications/Postgres.app/Contents/Versions/latest/bin");
  }
  return dirs;
}

function findBinDir() {
  return candidateBinDirs().find((d) => fs.existsSync(path.join(d, `postgres${EXE}`)) && fs.existsSync(path.join(d, `initdb${EXE}`))) ?? null;
}

function bin(dir, name) {
  return path.join(dir, `${name}${EXE}`);
}

function hasPostgis(binDir) {
  const r = spawnSync(bin(binDir, "pg_config"), ["--sharedir"], { encoding: "utf8" });
  const share = r.status === 0 ? r.stdout.trim() : path.join(binDir, "..", "share");
  return fs.existsSync(path.join(share, "extension", "postgis.control"));
}

// ─── Descărcare (doar Windows; pe Linux/macOS se folosește pachetul sistemului) ─
async function download(url, file) {
  if (fs.existsSync(file)) return;
  log(`descarc ${path.basename(file)} …`);
  const res = await fetch(url);
  if (!res.ok || !res.body) fail(`Descărcarea a eșuat (${res.status}) pentru ${url}. Verifică internetul și rulează din nou.`);
  const total = Number(res.headers.get("content-length") ?? 0);
  const tmp = `${file}.part`;
  const out = fs.createWriteStream(tmp);
  let done = 0;
  let lastPct = -10;
  for await (const chunk of res.body) {
    out.write(chunk);
    done += chunk.length;
    const pct = total ? Math.floor((done / total) * 100) : 0;
    if (pct >= lastPct + 10) {
      lastPct = pct;
      log(`  ${pct}% (${Math.round(done / 1e6)} MB)`);
    }
  }
  await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
  fs.renameSync(tmp, file);
}

function extractZip(zip, dest) {
  fs.mkdirSync(dest, { recursive: true });
  // Windows 10+ are tar (bsdtar) care citește și .zip.
  const r = spawnSync("tar", ["-xf", zip, "-C", dest], { stdio: "inherit" });
  if (r.status !== 0) fail(`Nu am putut dezarhiva ${path.basename(zip)}.`);
}

async function installRuntime() {
  if (!IS_WINDOWS) {
    fail(
      "Nu găsesc PostgreSQL cu PostGIS. Instalează-le din pachetele sistemului, de ex.:\n" +
        "  Ubuntu/Debian: sudo apt install postgresql-16 postgresql-16-postgis-3\n" +
        "  macOS: brew install postgresql@17 postgis\n" +
        "sau setează OPTIFLEET_PG_BIN la folderul bin al PostgreSQL.",
    );
  }
  const dl = path.join(RUNTIME, "downloads");
  fs.mkdirSync(dl, { recursive: true });
  const pgZip = path.join(dl, path.basename(DOWNLOADS.postgres));
  const gisZip = path.join(dl, path.basename(DOWNLOADS.postgis));
  await download(DOWNLOADS.postgres, pgZip);
  await download(DOWNLOADS.postgis, gisZip);

  log("dezarhivez PostgreSQL (conține și pgAdmin) …");
  extractZip(pgZip, RUNTIME);
  log("adaug PostGIS …");
  const tmp = path.join(RUNTIME, "postgis-tmp");
  fs.rmSync(tmp, { recursive: true, force: true });
  extractZip(gisZip, tmp);
  // Arhiva PostGIS are un singur folder (postgis-bundle-…) cu bin/lib/share → peste pgsql/.
  const inner = fs.readdirSync(tmp).map((d) => path.join(tmp, d)).find((d) => fs.statSync(d).isDirectory()) ?? tmp;
  for (const sub of fs.readdirSync(inner)) {
    const src = path.join(inner, sub);
    if (fs.statSync(src).isDirectory()) fs.cpSync(src, path.join(RUNTIME, "pgsql", sub), { recursive: true, force: true });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ─── Inițializarea bazei ──────────────────────────────────────────────────
function readCredentials() {
  return fs.existsSync(CREDENTIALS) ? JSON.parse(fs.readFileSync(CREDENTIALS, "utf8")) : null;
}

function initCluster(binDir) {
  if (!IS_WINDOWS && typeof process.getuid === "function" && process.getuid() === 0) {
    fail("PostgreSQL refuză să ruleze ca root. Pornește OptiFleet ca utilizator obișnuit.");
  }
  fs.mkdirSync(DATA, { recursive: true });
  const creds = {
    port: Number(process.env.OPTIFLEET_DB_PORT ?? 5433),
    superuser: "postgres",
    superPassword: randomBytes(24).toString("base64url"),
    appPassword: randomBytes(24).toString("base64url"),
    createdAt: new Date().toISOString(),
  };
  const pwfile = path.join(DATA, ".pwfile");
  fs.writeFileSync(pwfile, creds.superPassword, { mode: 0o600 });
  log("creez baza de date locală în .data/pg …");
  const r = spawnSync(bin(binDir, "initdb"), [
    "-D", PGDATA, "-U", "postgres", "-E", "UTF8", "--locale=C", "-A", "scram-sha-256", `--pwfile=${pwfile}`,
  ], { stdio: "inherit" });
  fs.rmSync(pwfile, { force: true });
  if (r.status !== 0) fail("initdb a eșuat (vezi mesajul de mai sus).");

  // Doar pe 127.0.0.1; fără socket Unix (conexiune TCP identică pe toate sistemele).
  fs.appendFileSync(path.join(PGDATA, "postgresql.conf"), [
    "",
    "# ── OptiFleet ──",
    "listen_addresses = '127.0.0.1'",
    `port = ${creds.port}`,
    "unix_socket_directories = ''",
    "max_connections = 60",
    "log_min_messages = warning",
    "",
  ].join("\n"));
  fs.writeFileSync(CREDENTIALS, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

async function setup() {
  let binDir = findBinDir();
  if (!binDir || !hasPostgis(binDir)) {
    await installRuntime();
    binDir = findBinDir();
    if (!binDir) fail("PostgreSQL nu a fost găsit după instalare.");
    if (!hasPostgis(binDir)) fail("PostGIS lipsește din runtime-ul PostgreSQL.");
  }
  if (!fs.existsSync(path.join(PGDATA, "PG_VERSION"))) initCluster(binDir);
  return binDir;
}

// ─── Pornire / oprire PostgreSQL ──────────────────────────────────────────
function superClient(creds, database = DB_NAME) {
  return new pg.Client({ host: "127.0.0.1", port: creds.port, user: creds.superuser, password: creds.superPassword, database });
}

async function canConnect(creds) {
  const c = superClient(creds, "postgres");
  try {
    await c.connect();
    await c.end();
    return true;
  } catch {
    return false;
  }
}

async function startPostgres(binDir, creds) {
  if (await canConnect(creds)) {
    log(`baza de date rula deja pe 127.0.0.1:${creds.port}; o folosesc`);
    return null;
  }
  const logFile = fs.openSync(path.join(DATA, "postgres.log"), "a");
  const child = spawn(bin(binDir, "postgres"), ["-D", PGDATA], { stdio: ["ignore", logFile, logFile], windowsHide: true });
  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`[optifleet] PostgreSQL s-a oprit neașteptat (cod ${code}). Vezi .data/postgres.log`);
      shutdown(1);
    }
  });
  for (let i = 0; i < 60; i += 1) {
    if (await canConnect(creds)) {
      log(`PostgreSQL pornit pe 127.0.0.1:${creds.port}`);
      return child;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  fail("PostgreSQL nu a pornit în 30 s. Vezi .data/postgres.log");
}

function stopPostgres(binDir) {
  if (!fs.existsSync(path.join(PGDATA, "postmaster.pid"))) return;
  spawnSync(bin(binDir, "pg_ctl"), ["stop", "-D", PGDATA, "-m", "fast", "-w", "-t", "20"], { stdio: "ignore" });
}

// ─── Migrații ─────────────────────────────────────────────────────────────
async function migrate(creds) {
  const admin = superClient(creds, "postgres");
  await admin.connect();
  const exists = await admin.query("select 1 from pg_database where datname = $1", [DB_NAME]);
  if (!exists.rowCount) {
    log(`creez baza „${DB_NAME}”`);
    await admin.query(`create database ${DB_NAME} encoding 'UTF8'`);
  }
  await admin.end();

  const c = superClient(creds);
  await c.connect();
  try {
    await c.query(`create schema if not exists platform;
      create table if not exists platform.migrations (
        name text primary key, sha256 text not null, applied_at timestamptz not null default now())`);
    const applied = new Map((await c.query("select name, sha256 from platform.migrations")).rows.map((r) => [r.name, r.sha256]));
    const changed = [];
    for (const rel of MIGRATIONS) {
      const sql = fs.readFileSync(path.join(ROOT, rel), "utf8");
      const sha = createHash("sha256").update(sql).digest("hex");
      if (applied.has(rel)) {
        if (applied.get(rel) !== sha) changed.push(rel);
        continue;
      }
      log(`aplic ${rel}`);
      try {
        await c.query(sql);
      } catch (err) {
        fail(`Migrația ${rel} a eșuat: ${err.message}`);
      }
      await c.query("insert into platform.migrations (name, sha256) values ($1, $2)", [rel, sha]);
    }
    if (changed.length) {
      log(`ATENȚIE: s-au schimbat după aplicare: ${changed.join(", ")}.`);
      log("  Pentru a le aplica pe o bază goală: npm run reset -- --yes (șterge datele locale!)");
    }
    // Parola rolului aplicației (din .data/credentials.json), la fiecare pornire.
    await c.query(`alter role optifleet_app password '${creds.appPassword.replace(/'/g, "''")}'`);
    await c.query(`grant connect on database ${DB_NAME} to optifleet_app`);
  } finally {
    await c.end();
  }
}

// ─── Next.js ──────────────────────────────────────────────────────────────
function appEnv(creds) {
  return {
    ...process.env,
    OPTIFLEET_DATABASE_URL: `postgres://optifleet_app:${encodeURIComponent(creds.appPassword)}@127.0.0.1:${creds.port}/${DB_NAME}`,
    OPTIFLEET_DATA_DIR: DATA,
    NEXT_TELEMETRY_DISABLED: "1",
  };
}

function nextBin() {
  const p = path.join(FRONTEND, "node_modules", "next", "dist", "bin", "next");
  if (!fs.existsSync(p)) fail("Lipsesc dependențele. Rulează o dată: npm install --prefix frontend");
  return p;
}

let shuttingDown = false;
let pgChild = null;
let appChild = null;
let binDirForStop = null;
let ownsDatabase = false;

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (IS_WINDOWS) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGINT");
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("opresc aplicația și baza de date …");
  killTree(appChild);
  // Oprim baza doar dacă o ține în viață acest proces (dev/start/db) — nu și
  // când `admin`/`backup` au folosit o bază pornită de aplicație.
  if (binDirForStop && ownsDatabase) stopPostgres(binDirForStop);
  log("oprit.");
  process.exit(code);
}

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
  try {
    process.on(sig, () => shutdown(0));
  } catch {
    // semnal indisponibil pe acest sistem
  }
}

async function runDatabase() {
  const binDir = await setup();
  const creds = readCredentials();
  if (!creds) fail("Lipsește .data/credentials.json. Rulează: npm run reset -- --yes");
  binDirForStop = binDir;
  pgChild = await startPostgres(binDir, creds);
  if (pgChild) ownsDatabase = true;
  await migrate(creds);
  return { binDir, creds };
}

async function runApp(mode) {
  const { creds } = await runDatabase();
  ownsDatabase = true; // aplicația oprește tot la ieșire, chiar dacă baza rămăsese pornită

  const args = mode === "dev" ? ["dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3000"] : ["start", "--hostname", "127.0.0.1", "--port", "3000"];
  appChild = spawn(process.execPath, [nextBin(), ...args], { cwd: FRONTEND, env: appEnv(creds), stdio: "inherit" });
  appChild.on("exit", (code) => shutdown(code ?? 0));
  log("aplicația pornește la http://127.0.0.1:3000");
}

// ─── Comenzi ──────────────────────────────────────────────────────────────
const [command = "dev", ...rest] = process.argv.slice(2);

switch (command) {
  case "dev":
  case "start":
    await runApp(command);
    break;
  case "db": {
    const { creds } = await runDatabase();
    ownsDatabase = true;
    log(`baza rulează. pgAdmin: host 127.0.0.1, port ${creds.port}, baza ${DB_NAME}, utilizator postgres`);
    log("parola e în .data/credentials.json (superPassword). Ctrl+C oprește baza.");
    break;
  }
  case "setup": {
    const binDir = await setup();
    log(`gata. PostgreSQL: ${binDir}`);
    break;
  }
  case "stop": {
    const binDir = findBinDir();
    if (binDir) stopPostgres(binDir);
    log("baza de date e oprită.");
    break;
  }
  case "status": {
    const creds = readCredentials();
    log(`date: ${DATA}`);
    log(`PostgreSQL: ${findBinDir() ?? "negăsit"}`);
    log(creds && (await canConnect(creds)) ? `baza rulează pe 127.0.0.1:${creds.port}` : "baza nu rulează");
    break;
  }
  case "admin": {
    const email = (rest[0] ?? "").trim().toLowerCase();
    if (!email.includes("@")) fail("Folosire: npm run admin -- email@firma.md");
    const { creds } = await runDatabase();
    const c = superClient(creds);
    await c.connect();
    const r = await c.query(
      "insert into public.platform_admins (user_id) select id from auth.users where email = $1 on conflict do nothing returning user_id",
      [email],
    );
    const known = await c.query("select 1 from auth.users where email = $1", [email]);
    await c.end();
    log(!known.rowCount ? `nu există cont cu ${email}; creează-l întâi din pagina de înregistrare.`
      : r.rowCount ? `${email} este acum administrator al platformei.` : `${email} era deja administrator.`);
    shutdown(0);
    break;
  }
  case "backup": {
    const { binDir, creds } = await runDatabase();
    const dir = path.join(DATA, "backups");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `optifleet-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);
    const r = spawnSync(bin(binDir, "pg_dump"), ["-h", "127.0.0.1", "-p", String(creds.port), "-U", "postgres", "-Fc", "-f", file, DB_NAME], {
      stdio: "inherit", env: { ...process.env, PGPASSWORD: creds.superPassword },
    });
    log(r.status === 0 ? `backup salvat: ${file}` : "backup-ul a eșuat");
    shutdown(r.status ?? 1);
    break;
  }
  case "test-db": {
    const { binDir, creds } = await runDatabase();
    const TEST_DB = "optifleet_test";
    const admin = superClient(creds, "postgres");
    await admin.connect();
    await admin.query(`drop database if exists ${TEST_DB} with (force)`);
    await admin.query(`create database ${TEST_DB} encoding 'UTF8'`);
    await admin.end();
    const files = [
      "db/platform/00_platform.sql",
      "supabase/tests/00_test_prelude.sql",
      ...fs.readdirSync(path.join(ROOT, "supabase", "sql")).filter((f) => /^(0[1-9]|1\d)_.*\.sql$/.test(f)).sort().map((f) => `supabase/sql/${f}`),
      "db/platform/90_realtime.sql",
      "supabase/tests/10_security_and_flows.sql",
    ];
    let failed = false;
    for (const rel of files) {
      const r = spawnSync(bin(binDir, "psql"), ["-h", "127.0.0.1", "-p", String(creds.port), "-U", "postgres", "-d", TEST_DB,
        "-v", "ON_ERROR_STOP=1", "-q", "-f", path.join(ROOT, rel)], {
        env: { ...process.env, PGPASSWORD: creds.superPassword, PGCLIENTENCODING: "UTF8" }, encoding: "utf8",
      });
      const out = `${r.stdout}${r.stderr}`;
      const passed = (out.match(/NOTICE:\s+ok /g) ?? []).length;
      if (r.status !== 0) {
        console.error(out.split("\n").filter((l) => /ERROR|FAIL/.test(l)).join("\n"));
        log(`EȘUAT la ${rel}`);
        failed = true;
        break;
      }
      if (passed) log(`${rel}: ${passed} verificări trecute`);
    }
    if (!failed) log("══ TOATE TESTELE SQL AU TRECUT ══");
    shutdown(failed ? 1 : 0);
    break;
  }
  case "reset": {
    if (!rest.includes("--yes")) fail("Resetarea ȘTERGE toate datele locale. Confirmă cu: npm run reset -- --yes");
    const binDir = findBinDir();
    if (binDir) stopPostgres(binDir);
    fs.rmSync(PGDATA, { recursive: true, force: true });
    fs.rmSync(CREDENTIALS, { force: true });
    log("baza locală a fost ștearsă; se recreează la următorul `npm run dev`.");
    break;
  }
  default:
    fail(`Comandă necunoscută: ${command}`);
}
