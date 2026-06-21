import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
import { extractCharacterSpec, renderSkinFromSpec, HFVisionProvider, QwenImageProvider, animePrompt } from "../packages/skin/dist/index.js";
import { buildMinecraftGLB } from "../packages/mcmodel/dist/index.js";

const env = Object.fromEntries(readFileSync("examples/next-demo/.env.local", "utf8").split("\n").filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const vision = new HFVisionProvider({ hfToken: env.HF_TOKEN, timeoutMs: 30000 });
const qwen = new QwenImageProvider({ apiKey: env.DASHSCOPE_API_KEY, endpoint: env.DASHSCOPE_ENDPOINT });

const CHARS = [["hutao", "Hu Tao"], ["klee", "Klee"], ["zhongli", "Zhongli"], ["keqing", "Keqing"], ["diluc", "Diluc"], ["ganyu", "Ganyu"], ["xiao", "Xiao"], ["venti", "Venti"], ["xiangling", "Xiangling"], ["qiqi", "Qiqi"]];
const SKINS = "examples/next-demo/public/skinmint/skins";
const CACHE = "/tmp/skinmint-bench";
mkdirSync(CACHE, { recursive: true });

// Content-driven color sampling: anchor regions to the CHARACTER bounding box
// (framing-robust) and EXCLUDE skin pixels (so the face doesn't pollute hair).
async function sampleColors(browser, b64) {
  const pg = await browser.newPage();
  const out = await pg.evaluate(async (src) => {
    const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
    const W = 192, H = Math.max(1, Math.round(192 * img.height / img.width));
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    const px = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
    const isBG = (r, g, b, a) => a < 40 || (Math.min(r, g, b) > 228 && Math.max(r, g, b) - Math.min(r, g, b) < 16);
    const isSkin = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return r >= g && g >= b - 8 && r - b >= 16 && r - b <= 95 && mx >= 175 && mx <= 252 && mx - mn >= 14 && mx - mn <= 95; };
    const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    const mode = (arr) => { if (!arr.length) return null; const m = new Map(); for (const [r, g, b] of arr) { const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3); const e = m.get(k) || [0, 0, 0, 0]; e[0] += r; e[1] += g; e[2] += b; e[3]++; m.set(k, e); } let best = null; for (const e of m.values()) if (!best || e[3] > best[3]) best = e; return [best[0] / best[3], best[1] / best[3], best[2] / best[3]]; };
    // character bbox
    let minY = H, maxY = 0, minX = W, maxX = 0, any = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [r, g, b, a] = px(x, y); if (!isBG(r, g, b, a)) { any = true; if (y < minY) minY = y; if (y > maxY) maxY = y; if (x < minX) minX = x; if (x > maxX) maxX = x; } }
    if (!any) { minY = 0; maxY = H - 1; minX = 0; maxX = W - 1; }
    const ch = maxY - minY + 1;
    const region = (f0, f1) => { const a = []; const y0 = (minY + f0 * ch) | 0, y1 = (minY + f1 * ch) | 0; for (let y = y0; y < y1; y++) for (let x = minX; x <= maxX; x++) { const [r, g, b, al] = px(x, y); if (isBG(r, g, b, al) || isSkin(r, g, b)) continue; a.push([r, g, b]); } return a; };
    const skinPx = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [r, g, b, a] = px(x, y); if (a >= 40 && isSkin(r, g, b)) skinPx.push([r, g, b]); }
    const c = (arr) => { const m = mode(arr); return m ? hex(m) : null; };
    return { skin: c(skinPx), hair: c(region(0, 0.2)), top: c(region(0.22, 0.46)), bottom: c(region(0.52, 0.82)), shoes: c(region(0.9, 1.0)) };
  }, "data:image/png;base64," + b64);
  await pg.close();
  return out;
}

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const rows = [];
for (const [id, name] of CHARS) {
  const pPath = `${CACHE}/${id}.png`;
  if (!existsSync(pPath)) { process.stdout.write(`drawing ${name}… `); const { png } = await qwen.generate({ prompt: animePrompt(`${name} from Genshin Impact`), size: "768*1024" }); writeFileSync(pPath, Buffer.from(png)); console.log("ok"); }
  const portrait = new Uint8Array(readFileSync(pPath));
  const b64 = Buffer.from(portrait).toString("base64");

  const sPath = `${CACHE}/${id}.spec.json`;
  let spec;
  if (existsSync(sPath)) spec = JSON.parse(readFileSync(sPath, "utf8"));
  else { spec = await extractCharacterSpec(portrait, { vision, mime: "image/png" }); writeFileSync(sPath, JSON.stringify(spec)); }

  // override region colors with robust sampling; keep VLM for semantics.
  const sat = (h) => { const n = parseInt(h.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return Math.max(r, g, b) - Math.min(r, g, b); };
  const c = await sampleColors(browser, b64);
  if (c.skin) spec.skin = c.skin;
  // hair: trust sampling, but if it's near-grayscale (likely caught an outline) and
  // the VLM saw a clear color, keep the VLM color.
  if (c.hair) spec.hair.color = (sat(c.hair) < 28 && sat(spec.hair.color) > 50) ? spec.hair.color : c.hair;
  if (c.top) spec.top.colors[0] = c.top;
  if (c.bottom) spec.bottom.colors[0] = c.bottom;
  if (c.shoes) spec.shoes.color = c.shoes;
  console.log(id, JSON.stringify(c), "|", spec.hair.style, spec.top.type, spec.bottom.type, spec.headwear.type);

  const oursGlb = Buffer.from(await buildMinecraftGLB(renderSkinFromSpec(spec), { overlay: true })).toString("base64");
  const gtGlb = Buffer.from(await buildMinecraftGLB(new Uint8Array(readFileSync(`${SKINS}/${id}.png`)), { overlay: true })).toString("base64");
  rows.push({ id, portrait: b64, oursGlb, gtGlb });
}

const vp = (b64) => `<div class="vp" data-glb="${b64}" style="width:150px;height:190px"></div>`;
const HTML = `<!DOCTYPE html><html><head><meta charset=utf-8>
<style>html,body{margin:0;background:#f1ead9;font-family:monospace;color:#1a1815}table{border-collapse:collapse;margin:8px}td{text-align:center;padding:3px;border-bottom:1px solid #ccc}th{font-size:12px;padding:6px}.lbl{font-weight:700;font-size:12px}img{height:170px;border:1px solid #999;border-radius:6px}</style>
<script type=importmap>{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script></head><body>
<table><tr><th>输入立绘</th><th>我们的</th><th>手工皮肤(老师)</th></tr>
${rows.map((r) => `<tr><td><div class="lbl">${r.id}</div><img src="data:image/png;base64,${r.portrait}"></td><td>${vp(r.oursGlb)}</td><td>${vp(r.gtGlb)}</td></tr>`).join("")}
</table>
<script type=module>import * as THREE from "three";import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
const vps=[...document.querySelectorAll(".vp")];
// Render each cell sequentially → snapshot to <img> → dispose context (avoid the ~16 WebGL-context limit).
for(const el of vps){const w=el.clientWidth,h=el.clientHeight;const sc=new THREE.Scene();const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});r.setPixelRatio(2);r.setSize(w,h);const cam=new THREE.PerspectiveCamera(30,w/h,.1,100);cam.position.set(2.3,1.1,4.6);cam.lookAt(0,1.05,0);
await new Promise(done=>{new GLTFLoader().load("data:model/gltf-binary;base64,"+el.dataset.glb,g=>{sc.add(g.scene);r.render(sc,cam);const im=new Image();im.width=w;im.height=h;im.style.border="none";im.style.borderRadius="0";im.src=r.domElement.toDataURL();el.innerHTML="";el.appendChild(im);r.dispose();r.forceContextLoss();done();},undefined,()=>{r.dispose();r.forceContextLoss();done();})});}
window.__done=1;</script></body></html>`;
const p = await browser.newPage({ viewport: { width: 620, height: 1100 }, deviceScaleFactor: 1.4 });
await p.setContent(HTML, { waitUntil: "networkidle" });
await p.waitForFunction("window.__done===1", { timeout: 40000 }).catch(() => {});
await sleep(1000);
const full = await p.evaluate(() => document.querySelector("table").scrollHeight + 20);
const half = Math.ceil(full / 2);
await p.screenshot({ path: "/tmp/skinmint-shots/bench-A.png", clip: { x: 0, y: 0, width: 470, height: half } });
await p.screenshot({ path: "/tmp/skinmint-shots/bench-B.png", clip: { x: 0, y: half, width: 470, height: full - half } });
await browser.close();
console.log("bench → bench-A.png + bench-B.png");
