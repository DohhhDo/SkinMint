#!/usr/bin/env node
// Tiny zero-dependency web server for manually testing 立绘 → MC skin.
// Holds the keys server-side (browser never sees them) and proxies to the
// Modal backends + HF caption the CLI uses.
//
//   node src/server.mjs            # → http://localhost:8787
//
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, requireKey } from "./env.mjs";
import { captionImage, extractColorsVLM } from "./vision.mjs";
import { generateSkin, generateSkinIPA, segmentImage } from "./modal.mjs";
import { skinPrompt } from "./style.mjs";
import { recolorSkin } from "../web/recolor.mjs";
import { encodeRGBA } from "./png.mjs";
import { decodePNG } from "../scripts/pngdec.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(__dirname, "..", "web");

// Curated detailed base skins (real shading/uniform structure). The recolor
// repaints these to the 立绘's palette while keeping their crafted detail.
const BASE_DIR = resolve(__dirname, "..", "bases");
const BASES = ["schoolgirl", "dress", "hoodie", "kimono", "sporty", "coat"];
const baseCache = new Map();
function loadBase(name) {
  const key = BASES.includes(name) ? name : "schoolgirl";
  if (!baseCache.has(key)) baseCache.set(key, decodePNG(join(BASE_DIR, key + ".png")).data);
  return baseCache.get(key);
}
const PORT = Number(process.env.PORT) || 8787;
const MAX_BODY = 30 * 1024 * 1024; // 30MB — a 立绘 as base64 fits easily.

const env = loadEnv();

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function handleGenerate(req, res) {
  const raw = await readBody(req);
  let payload;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return send(res, 400, JSON.stringify({ ok: false, error: "Invalid JSON body" }));
  }

  const { imageBase64, mime = "image/png", seed, steps } = payload;
  if (!imageBase64) return send(res, 400, JSON.stringify({ ok: false, error: "imageBase64 required" }));
  const image = new Uint8Array(Buffer.from(imageBase64, "base64"));

  // Mode: "ipa" (identity, default when deployed) | "text2img" | "img2img" (experiment).
  let mode = payload.mode || (env.MODAL_SKIN_IPA_ENDPOINT ? "ipa" : "text2img");
  if (mode === "ipa" && !env.MODAL_SKIN_IPA_ENDPOINT) mode = "text2img"; // graceful fallback

  // 1) Prompt: explicit override > caption > generic. Caption helps every mode,
  //    including ipa (text attributes + image reference together).
  let caption = "";
  let captionError = null;
  if (payload.prompt && payload.prompt.trim()) {
    caption = payload.prompt.trim();
  } else if (payload.caption !== false && env.HF_TOKEN) {
    try {
      caption = await captionImage(image, env.HF_TOKEN, { mime });
    } catch (err) {
      captionError = err.message;
    }
  }
  const prompt = payload.prompt && payload.prompt.trim() ? payload.prompt.trim() : skinPrompt(caption);

  const token = env.MODAL_SKIN_TOKEN;
  const seedN = Number.isFinite(seed) ? seed : 0;
  const stepsN = Number.isFinite(steps) ? steps : mode === "ipa" ? 30 : 25;

  try {
    let png;
    if (mode === "ipa") {
      png = await generateSkinIPA({
        endpoint: env.MODAL_SKIN_IPA_ENDPOINT,
        token,
        prompt,
        refImage: image,
        ipScale: Number.isFinite(payload.ipScale) ? payload.ipScale : 0.6,
        seed: seedN,
        steps: stepsN,
      });
    } else {
      const endpoint = requireKey(env, "MODAL_SKIN_ENDPOINT", "The skin backend.");
      png = await generateSkin({
        endpoint,
        token,
        prompt,
        seed: seedN,
        steps: stepsN,
        ...(mode === "img2img"
          ? { initImage: image, strength: Number.isFinite(payload.strength) ? payload.strength : 0.7 }
          : {}),
      });
    }
    return send(
      res,
      200,
      JSON.stringify({
        ok: true,
        mode,
        caption,
        captionError,
        prompt,
        skinBase64: Buffer.from(png).toString("base64"),
      }),
    );
  } catch (err) {
    return send(res, 502, JSON.stringify({ ok: false, error: err.message, mode, prompt }));
  }
}

async function handleRecolor(req, res) {
  const raw = await readBody(req);
  let payload;
  try { payload = JSON.parse(raw.toString("utf8")); }
  catch { return send(res, 400, JSON.stringify({ ok: false, error: "Invalid JSON body" })); }
  if (!payload.imageBase64) return send(res, 400, JSON.stringify({ ok: false, error: "imageBase64 required" }));

  // Colors: VLM-extracted (robust for tiny accents like red eyes), with any
  // client-supplied overrides winning. Falls back to neutral defaults.
  let vlm = {};
  let vlmError = null;
  if (payload.useVlm !== false && env.HF_TOKEN) {
    try {
      vlm = await extractColorsVLM(
        new Uint8Array(Buffer.from(payload.imageBase64, "base64")),
        env.HF_TOKEN,
        { mime: payload.mime ?? "image/png" },
      );
    } catch (err) { vlmError = err.message; }
  }
  const ov = payload.colors ?? {};
  const pick = (k) => ov[k] ?? vlm[k];
  const colors = {
    hair: pick("hair"), skin: pick("skin"), top: pick("top"), bottom: pick("bottom"),
    accent: pick("accent") ?? pick("eyes"), eye: pick("eyes") ?? pick("accent"),
    shoe: (pick("bottom") ?? [40, 40, 50]).map((v) => Math.round(v * 0.55)),
  };
  try {
    const chosen = payload.base ?? vlm.archetype ?? "schoolgirl";
    const base = loadBase(chosen);
    const atlas = recolorSkin(base, colors);
    const png = encodeRGBA(atlas, 64, 64);
    const hex = (c) => (Array.isArray(c) ? "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("") : null);
    const colorHex = {};
    for (const k of ["hair", "eyes", "skin", "top", "bottom", "accent"]) if (vlm[k]) colorHex[k] = hex(vlm[k]);
    return send(res, 200, JSON.stringify({
      ok: true,
      archetype: BASES.includes(chosen) ? chosen : "schoolgirl",
      skinBase64: Buffer.from(png).toString("base64"),
      colors: colorHex,
      vlmError,
    }));
  } catch (err) {
    return send(res, 500, JSON.stringify({ ok: false, error: err.message }));
  }
}

async function handleSegment(req, res) {
  if (!env.MODAL_SEG_ENDPOINT) {
    return send(res, 501, JSON.stringify({ ok: false, error: "Segmentation not deployed (MODAL_SEG_ENDPOINT)" }));
  }
  const raw = await readBody(req);
  let payload;
  try { payload = JSON.parse(raw.toString("utf8")); }
  catch { return send(res, 400, JSON.stringify({ ok: false, error: "Invalid JSON body" })); }
  if (!payload.imageBase64) return send(res, 400, JSON.stringify({ ok: false, error: "imageBase64 required" }));
  try {
    const png = await segmentImage({
      endpoint: env.MODAL_SEG_ENDPOINT,
      token: env.MODAL_SKIN_TOKEN,
      image: new Uint8Array(Buffer.from(payload.imageBase64, "base64")),
    });
    return send(res, 200, JSON.stringify({ ok: true, cutoutBase64: Buffer.from(png).toString("base64") }));
  } catch (err) {
    return send(res, 502, JSON.stringify({ ok: false, error: err.message }));
  }
}

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
};

// Map a request path to a file inside WEB_DIR, refusing traversal.
async function serveStatic(pathname, res) {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const full = resolve(WEB_DIR, rel);
  if (full !== WEB_DIR && !full.startsWith(WEB_DIR + "/")) {
    return send(res, 403, JSON.stringify({ ok: false, error: "Forbidden" }));
  }
  const ext = full.slice(full.lastIndexOf("."));
  const type = CONTENT_TYPES[ext];
  if (!type) return send(res, 404, JSON.stringify({ ok: false, error: "Not found" }));
  try {
    const data = await readFile(full);
    return send(res, 200, data, type);
  } catch {
    return send(res, 404, JSON.stringify({ ok: false, error: "Not found" }));
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (req.method === "POST" && url.pathname === "/api/generate") {
      return await handleGenerate(req, res);
    }
    if (req.method === "POST" && url.pathname === "/api/segment") {
      return await handleSegment(req, res);
    }
    if (req.method === "POST" && url.pathname === "/api/recolor") {
      return await handleRecolor(req, res);
    }
    if (req.method === "GET" && url.pathname === "/api/config") {
      // Let the UI show what's wired up (never the secret values).
      return send(
        res,
        200,
        JSON.stringify({
          ok: true,
          hasModal: Boolean(env.MODAL_SKIN_ENDPOINT),
          hasCaption: Boolean(env.HF_TOKEN),
          hasIPA: Boolean(env.MODAL_SKIN_IPA_ENDPOINT),
          hasSeg: Boolean(env.MODAL_SEG_ENDPOINT),
        }),
      );
    }
    if (req.method === "GET") {
      return await serveStatic(url.pathname, res);
    }
    send(res, 404, JSON.stringify({ ok: false, error: "Not found" }));
  } catch (err) {
    send(res, 500, JSON.stringify({ ok: false, error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`tachie2skin web → http://localhost:${PORT}`);
  console.log(`  text2img backend: ${env.MODAL_SKIN_ENDPOINT ? "ready" : "MISSING MODAL_SKIN_ENDPOINT"}`);
  console.log(`  IP-Adapter (身份): ${env.MODAL_SKIN_IPA_ENDPOINT ? "ready" : "not deployed (run modal/skin_ipa.py)"}`);
  console.log(`  anime 抠图:       ${env.MODAL_SEG_ENDPOINT ? "ready" : "not deployed (run modal/segment.py)"}`);
  console.log(`  caption (HF):     ${env.HF_TOKEN ? "ready" : "off (no HF_TOKEN)"}`);
});
