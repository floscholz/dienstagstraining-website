import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const envFile = resolve(projectRoot, ".env.deploy");
const distDirectory = resolve(projectRoot, "dist");
const netlifyStateFile = resolve(projectRoot, ".netlify/state.json");
const functionFile = resolve(projectRoot, "netlify/functions/nuudel.mjs");

function fail(message) {
  throw new Error(message);
}

function run(command, args, label, options = {}) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: { ...process.env, ...options.env },
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    fail(`${label} konnte nicht gestartet werden: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${label} fehlgeschlagen (Exit-Code ${result.status ?? "unbekannt"}).`);
  }
}

function requireProgram(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "ignore",
    shell: false,
  });
  if (result.error || result.status !== 0) {
    fail(`Benötigtes Programm nicht verfügbar: ${command}`);
  }
}

function loadDeployEnvironment() {
  if (!existsSync(envFile)) {
    fail(
      ".env.deploy fehlt. Bitte .env.deploy.example nach .env.deploy kopieren und das FTP-Passwort lokal eintragen.",
    );
  }

  const values = {};
  for (const rawLine of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  for (const key of ["FTP_HOST", "FTP_PORT", "FTP_USER", "FTP_PASSWORD"]) {
    if (!values[key]) {
      fail(`${key} fehlt oder ist leer in .env.deploy.`);
    }
  }
  const port = Number(values.FTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail("FTP_PORT in .env.deploy ist ungültig.");
  }
}

function loadNetlifySiteId() {
  if (!existsSync(netlifyStateFile)) {
    fail(
      ".netlify/state.json fehlt. Das bestehende Netlify-Projekt muss lokal verknüpft sein; es wird keine neue Site erzeugt.",
    );
  }
  let state;
  try {
    state = JSON.parse(readFileSync(netlifyStateFile, "utf8"));
  } catch {
    fail(".netlify/state.json ist ungültig.");
  }
  if (typeof state.siteId !== "string" || !state.siteId.trim()) {
    fail("In .netlify/state.json fehlt die bestehende Netlify-Site-ID.");
  }
  return state.siteId;
}

function verifyProject() {
  if (resolve(process.cwd()) !== projectRoot) {
    fail(`Bitte im Projektverzeichnis ausführen: ${projectRoot}`);
  }
  for (const path of [
    resolve(projectRoot, "package.json"),
    resolve(projectRoot, "netlify.toml"),
    functionFile,
  ]) {
    if (!existsSync(path)) fail(`Erforderliche Projektdatei fehlt: ${path}`);
  }
}

function verifyDist() {
  if (!existsSync(distDirectory) || !statSync(distDirectory).isDirectory()) {
    fail("Build-Ausgabe dist/ fehlt.");
  }
  if (!existsSync(resolve(distDirectory, "index.html"))) {
    fail("Build-Ausgabe dist/index.html fehlt.");
  }
  if (readdirSync(distDirectory).length === 0) {
    fail("Build-Ausgabe dist/ ist leer.");
  }
}

try {
  console.log(checkOnly ? "Deployment-Validierung (ohne Netzwerk)" : "Production-Deployment");
  verifyProject();
  requireProgram("npm");
  requireProgram("npx");
  requireProgram("python3");
  loadDeployEnvironment();
  const siteId = loadNetlifySiteId();

  run("npm", ["test"], "Tests");
  run("npm", ["run", "build"], "Produktionsbuild");
  verifyDist();

  if (checkOnly) {
    console.log("\nOK: Tests, Build, dist/, Netlify-Verknüpfung und lokale Deploy-Konfiguration sind gültig.");
    console.log("Es wurde keine Netzwerkverbindung hergestellt und nichts veröffentlicht.");
    process.exit(0);
  }

  run(
    "npx",
    [
      "--yes",
      "netlify-cli@latest",
      "deploy",
      "--prod",
      "--no-build",
      "--dir=dist",
      "--functions=netlify/functions",
      `--site=${siteId}`,
    ],
    "Netlify Production Deploy",
    { env: { CI: "1", NETLIFY_SITE_ID: siteId } },
  );

  run("python3", ["scripts/deploy-ftp.py"], "FTP-Upload des identischen dist/-Stands");

  console.log("\nDeployment abgeschlossen:");
  console.log("- Tests erfolgreich");
  console.log("- Produktionsbuild erfolgreich");
  console.log("- Netlify Production aktualisiert");
  console.log("- dist/ auf den FTP-Webspace hochgeladen");
} catch (error) {
  console.error(`\nABBRUCH: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
