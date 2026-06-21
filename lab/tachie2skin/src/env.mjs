import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Where we borrow keys from. We intentionally read the main SkinMint env file
 * directly instead of importing any @skinmint package — keys are shared, code is not.
 * A local `lab/tachie2skin/.env` (if present) wins, so this tool can run on its
 * own keys too.
 */
const SOURCES = [
  join(__dirname, "..", ".env"),
  resolve(__dirname, "..", "..", "..", "examples", "next-demo", ".env.local"),
];

/** Parse a dotenv file into a plain object. Last-write-wins per key. */
function parseDotenv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

/**
 * Loads keys with precedence: process.env > local .env > main SkinMint .env.local.
 * Returns a frozen object; never throws on a missing file.
 */
export function loadEnv() {
  const merged = {};
  // Lowest precedence first: main project, then local file, then real env.
  for (const file of [...SOURCES].reverse()) {
    if (existsSync(file)) Object.assign(merged, parseDotenv(readFileSync(file, "utf8")));
  }
  Object.assign(merged, process.env);
  return Object.freeze(merged);
}

/** Read a required key or fail with a clear, actionable message. */
export function requireKey(env, name, hint) {
  const v = env[name];
  if (!v) {
    throw new Error(
      `Missing ${name}. ${hint ?? ""}\n` +
        `Set it in lab/tachie2skin/.env or in the main examples/next-demo/.env.local`,
    );
  }
  return v;
}
