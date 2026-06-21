import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
import { buildMinecraftGLB } from "../packages/mcmodel/dist/index.js";

const CHARS = ["hutao", "klee", "zhongli", "keqing", "diluc", "ganyu", "xiao", "venti", "xiangling", "qiqi"];
const SKINS = "examples/next-demo/public/skinmint/skins";
const CACHE = "/tmp/skinmint-bench";

// PROJECT: per-face pixel projection from the 立绘, with per-block DOMINANT
// sampling (not blur), per-region PALETTE QUANTIZATION (crisp not noisy), skin
// exclusion for outfit regions, and a crisp eye overlay.
const PROJECT = async (args) => {
  const { src, eyeHex } = args;
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
  const WW = 240, HH = Math.max(1, Math.round(240 * img.height / img.width));
  const wcv = document.createElement("canvas"); wcv.width = WW; wcv.height = HH;
  wcv.getContext("2d").drawImage(img, 0, 0, WW, HH);
  const D = wcv.getContext("2d").getImageData(0, 0, WW, HH).data;
  const A = (x, y) => { const i = (y * WW + x) * 4; return [D[i], D[i + 1], D[i + 2], D[i + 3]]; };
  const sat = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
  const isBG = (r, g, b, a) => a < 40 || (Math.min(r, g, b) > 228 && sat(r, g, b) < 16);
  const isSkin = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return r >= g && g >= b - 8 && r - b >= 16 && r - b <= 95 && mx >= 175 && mx <= 252 && mx - mn >= 14 && mx - mn <= 95; };
  const qz = (r, g, b) => ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
  const uqz = (k) => [((k >> 8) & 15) * 17 + 8, ((k >> 4) & 15) * 17 + 8, (k & 15) * 17 + 8];
  // bbox + face bbox
  let bx0 = WW, by0 = HH, bx1 = 0, by1 = 0, any = false;
  for (let y = 0; y < HH; y++) for (let x = 0; x < WW; x++) { const [r, g, b, a] = A(x, y); if (!isBG(r, g, b, a)) { any = true; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; } }
  if (!any) { bx0 = 0; by0 = 0; bx1 = WW - 1; by1 = HH - 1; }
  const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1, bcx = (bx0 + bx1) / 2;
  let fx0 = WW, fy0 = HH, fx1 = 0, fy1 = 0, fany = false;
  for (let y = by0; y < by0 + bh * 0.45; y++) for (let x = bx0; x <= bx1; x++) { const [r, g, b, a] = A(x, y); if (a >= 40 && isSkin(r, g, b)) { fany = true; if (x < fx0) fx0 = x; if (x > fx1) fx1 = x; if (y < fy0) fy0 = y; if (y > fy1) fy1 = y; } }
  if (!fany) { fx0 = bcx - bw * 0.12; fx1 = bcx + bw * 0.12; fy0 = by0 + bh * 0.05; fy1 = by0 + bh * 0.18; }
  const fw = fx1 - fx0, fh = fy1 - fy0, fcx = (fx0 + fx1) / 2;
  const R = (x, y, w, h) => ({ x: Math.max(0, x), y: Math.max(0, y), w: Math.max(1, w), h: Math.max(1, h) });

  const sk = document.createElement("canvas"); sk.width = 64; sk.height = 64; const sc = sk.getContext("2d");
  const fill = (dx, dy, dw, dh, c) => { sc.fillStyle = `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`; sc.fillRect(dx, dy, dw, dh); };
  const nearest = (c, pal) => { let bi = 0, bd = 1e9; for (let i = 0; i < pal.length; i++) { const p = pal[i]; const dd = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2; if (dd < bd) { bd = dd; bi = i; } } return pal[bi]; };
  const histo = (g, exSkin) => { const h = new Map(); const x1 = Math.min(WW, (g.x + g.w) | 0), y1 = Math.min(HH, (g.y + g.h) | 0); for (let y = g.y | 0; y < y1; y++) for (let x = g.x | 0; x < x1; x++) { const [r, gg, b, a] = A(x, y); if (isBG(r, gg, b, a) || (exSkin && isSkin(r, gg, b))) continue; const k = qz(r, gg, b); h.set(k, (h.get(k) || 0) + 1); } return h; };
  const palette = (g, K, exSkin) => { const h = histo(g, exSkin); return [...h.entries()].sort((a, b) => b[1] - a[1]).slice(0, K).map((e) => uqz(e[0])); };
  // paint a region into a dw×dh skin rect: per output pixel take block-dominant (excl bg/skin), snap to region palette
  const paint = (g, dx, dy, dw, dh, K, exSkin) => {
    const pal = palette(g, K, exSkin);
    if (!pal.length) { fill(dx, dy, dw, dh, [120, 120, 120]); return [120, 120, 120]; }
    for (let oy = 0; oy < dh; oy++) for (let ox = 0; ox < dw; ox++) {
      const sx0 = (g.x + (ox / dw) * g.w) | 0, sx1 = Math.max(sx0 + 1, (g.x + ((ox + 1) / dw) * g.w) | 0);
      const sy0 = (g.y + (oy / dh) * g.h) | 0, sy1 = Math.max(sy0 + 1, (g.y + ((oy + 1) / dh) * g.h) | 0);
      const bh2 = new Map();
      for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) { const [r, gg, b, a] = A(x, y); if (isBG(r, gg, b, a) || (exSkin && isSkin(r, gg, b))) continue; const k = qz(r, gg, b); bh2.set(k, (bh2.get(k) || 0) + 1); }
      let dom = null, dc = 0; for (const [k, c] of bh2) if (c > dc) { dc = c; dom = k; }
      fill(dx + ox, dy + oy, 1, 1, nearest(dom != null ? uqz(dom) : pal[0], pal));
    }
    return pal[0];
  };

  const headTop = R(fcx - fw * 0.85, by0, fw * 1.7, (fy0 - by0) + fh * 0.35);
  const face = R(fx0 - fw * 0.05, fy0, fw * 1.1, fh * 1.05);
  const torso = R(bcx - bw * 0.14, fy1 + fh * 0.1, bw * 0.28, bh * 0.26); // narrow central chest
  const armL = R(bx0, fy1 + fh * 0.2, bw * 0.13, bh * 0.3);
  const armR = R(bx1 - bw * 0.13, fy1 + fh * 0.2, bw * 0.13, bh * 0.3);
  const legL = R(bcx - bw * 0.15, by0 + bh * 0.58, bw * 0.13, bh * 0.4);
  const legR = R(bcx + bw * 0.02, by0 + bh * 0.58, bw * 0.13, bh * 0.4);

  // HEAD: face front + hair top/sides/back
  const skinC = paint(face, 8, 8, 8, 8, 6, false);
  const hairC = paint(headTop, 8, 0, 8, 8, 4, true);
  fill(16, 0, 8, 8, skinC);
  fill(0, 8, 8, 8, hairC); fill(16, 8, 8, 8, hairC); fill(24, 8, 8, 8, hairC);
  // BODY: outfit (exclude skin) front + back; sides/caps = dominant
  const topC = paint(torso, 20, 20, 8, 12, 5, true);
  paint(torso, 32, 20, 8, 12, 5, true);
  fill(20, 16, 8, 4, topC); fill(28, 16, 8, 4, topC); fill(16, 20, 4, 12, topC); fill(28, 20, 4, 12, topC);
  // ARMS
  const arC = paint(armR, 44, 20, 4, 12, 4, false); fill(40, 20, 4, 12, arC); fill(48, 20, 4, 12, arC); fill(52, 20, 4, 12, arC); fill(44, 16, 4, 4, arC); fill(48, 16, 4, 4, arC);
  const alC = paint(armL, 36, 52, 4, 12, 4, false); fill(32, 52, 4, 12, alC); fill(40, 52, 4, 12, alC); fill(44, 52, 4, 12, alC); fill(36, 48, 4, 4, alC); fill(40, 48, 4, 4, alC);
  // LEGS
  const lrC = paint(legR, 4, 20, 4, 12, 4, false); fill(0, 20, 4, 12, lrC); fill(8, 20, 4, 12, lrC); fill(12, 20, 4, 12, lrC); fill(4, 16, 4, 4, lrC); fill(8, 16, 4, 4, lrC);
  const llC = paint(legL, 20, 52, 4, 12, 4, false); fill(16, 52, 4, 12, llC); fill(24, 52, 4, 12, llC); fill(28, 52, 4, 12, llC); fill(20, 48, 4, 4, llC); fill(24, 48, 4, 4, llC);
  // EYES crisp overlay
  const eye = eyeHex ? [parseInt(eyeHex.slice(1, 3), 16), parseInt(eyeHex.slice(3, 5), 16), parseInt(eyeHex.slice(5, 7), 16)] : [60, 40, 40];
  fill(10, 11, 2, 1, [250, 250, 250]); fill(13, 11, 2, 1, [250, 250, 250]);
  fill(10, 12, 2, 1, eye); fill(13, 12, 2, 1, eye);
  fill(11, 14, 2, 1, [skinC[0] * 0.72, skinC[1] * 0.56, skinC[2] * 0.56]);
  return sk.toDataURL("image/png");
};

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const pj = await browser.newPage();
const rows = [];
for (const id of CHARS) {
  const portrait = readFileSync(`${CACHE}/${id}.png`);
  const b64 = portrait.toString("base64");
  const eyeHex = existsSync(`${CACHE}/${id}.spec.json`) ? JSON.parse(readFileSync(`${CACHE}/${id}.spec.json`, "utf8")).eyes?.color : "#5a3a2a";
  const skinDataUrl = await pj.evaluate(PROJECT, { src: "data:image/png;base64," + b64, eyeHex });
  const skinPng = new Uint8Array(Buffer.from(skinDataUrl.split(",")[1], "base64"));
  writeFileSync(`/tmp/skinmint-bench/${id}.skin.png`, Buffer.from(skinPng));
  const oursGlb = Buffer.from(await buildMinecraftGLB(skinPng, { overlay: true })).toString("base64");
  const gtGlb = Buffer.from(await buildMinecraftGLB(new Uint8Array(readFileSync(`${SKINS}/${id}.png`)), { overlay: true })).toString("base64");
  rows.push({ id, portrait: b64, skin: skinDataUrl.split(",")[1], oursGlb, gtGlb });
  console.log(id, "projected");
}

const vp = (b64) => `<div class="vp" data-glb="${b64}" style="width:150px;height:185px"></div>`;
const HTML = `<!DOCTYPE html><html><head><meta charset=utf-8><style>html,body{margin:0;background:#f1ead9;font-family:monospace;color:#1a1815}table{border-collapse:collapse;margin:8px}td{text-align:center;padding:3px;border-bottom:1px solid #ccc}th{font-size:12px}.lbl{font-weight:700;font-size:12px}img{height:160px;border:1px solid #999;border-radius:6px}img.sk{height:64px;image-rendering:pixelated}</style>
<script type=importmap>{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script></head><body>
<table><tr><th>立绘</th><th>投影皮肤</th><th>我们的模型</th><th>手工皮肤(老师)</th></tr>
${rows.map((r) => `<tr><td><div class="lbl">${r.id}</div><img src="data:image/png;base64,${r.portrait}"></td><td><img class=sk src="data:image/png;base64,${r.skin}"></td><td>${vp(r.oursGlb)}</td><td>${vp(r.gtGlb)}</td></tr>`).join("")}
</table>
<script type=module>import * as THREE from "three";import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";const vps=[...document.querySelectorAll(".vp")];for(const el of vps){const w=el.clientWidth,h=el.clientHeight;const sc=new THREE.Scene();const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});r.setPixelRatio(2);r.setSize(w,h);const cam=new THREE.PerspectiveCamera(30,w/h,.1,100);cam.position.set(2.3,1.1,4.6);cam.lookAt(0,1.05,0);await new Promise(done=>{new GLTFLoader().load("data:model/gltf-binary;base64,"+el.dataset.glb,g=>{sc.add(g.scene);r.render(sc,cam);const im=new Image();im.width=w;im.height=h;im.src=r.domElement.toDataURL();el.innerHTML="";el.appendChild(im);r.dispose();r.forceContextLoss();done();},undefined,()=>{r.dispose();r.forceContextLoss();done();})});}window.__done=1;</script></body></html>`;
const p = await browser.newPage({ viewport: { width: 640, height: 1100 }, deviceScaleFactor: 1.4 });
await p.setContent(HTML, { waitUntil: "networkidle" });
await p.waitForFunction("window.__done===1", { timeout: 40000 }).catch(() => {});
await sleep(1000);
const full = await p.evaluate(() => document.querySelector("table").scrollHeight + 16);
const half = Math.ceil(full / 2);
await p.screenshot({ path: "/tmp/skinmint-shots/proj-A.png", clip: { x: 0, y: 0, width: 600, height: half } });
await p.screenshot({ path: "/tmp/skinmint-shots/proj-B.png", clip: { x: 0, y: half, width: 600, height: full - half } });
await browser.close();
console.log("→ proj-A.png + proj-B.png");
