import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Per-IP daily quota for AI generation. Curated preset downloads (/api/mc-char) are NOT counted —
// they are free, pre-made characters. Only the AI path (text 立绘 → model, or upload → model) costs
// money, so it is capped: LIMIT model generations per IP per day. The day resets at China midnight.
const LIMIT = 3;
const dir = join(process.cwd(), ".skinmint-data");
const file = join(dir, "ratelimit.json");

// YYYY-MM-DD in UTC+8 (China), so the daily reset lands at local midnight.
function today(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
function keyOf(ip: string): string {
  return `${today()}|${ip}`;
}
function load(): Record<string, number> {
  try { return JSON.parse(readFileSync(file, "utf8")) as Record<string, number>; } catch { return {}; }
}
function save(d: Record<string, number>): void {
  try { mkdirSync(dir, { recursive: true }); writeFileSync(file, JSON.stringify(d)); } catch { /* best-effort */ }
}

/** Real client IP — behind nginx via X-Forwarded-For (first hop) / X-Real-IP. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) { const first = xff.split(",")[0]?.trim(); if (first) return first; }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export interface Quota { ok: boolean; used: number; limit: number; }

/** Check remaining quota WITHOUT spending (gate the 立绘 draw before the model build). */
export function peek(ip: string): Quota {
  const used = load()[keyOf(ip)] ?? 0;
  return { ok: used < LIMIT, used, limit: LIMIT };
}

/** Spend one generation if quota remains. Prunes other days to keep the file tiny. */
export function consume(ip: string): Quota {
  const d = load();
  const k = keyOf(ip);
  const used = d[k] ?? 0;
  if (used >= LIMIT) return { ok: false, used, limit: LIMIT };
  const t = today();
  for (const key of Object.keys(d)) if (!key.startsWith(`${t}|`)) delete d[key]; // drop stale days
  d[k] = used + 1;
  save(d);
  return { ok: true, used: used + 1, limit: LIMIT };
}

export const QUOTA_MESSAGE = "今天的生成次数用完啦（每个 IP 每天 3 次）。预设角色仍可随时直接下载，AI 生成请明天再来～";
