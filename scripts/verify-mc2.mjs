import { buildMinecraftGLB } from "/Users/mac/Projects/SkinMint/packages/mcmodel/dist/index.js";
import zlib from "node:zlib";
import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";

// ---------- paint a 64×64 skin (RGBA, transparent default) ----------
const W = 64, H = 64;
const buf = new Uint8Array(W * H * 4);
const set = (x, y, r, g, b, a = 255) => { const i = (y * W + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a; };
const rect = (x, y, w, h, [r, g, b], a = 255) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, r, g, b, a); };
const skin = [232, 185, 140], shirt = [59, 111, 184], pants = [43, 58, 103], hair = [74, 48, 38];

// head base
[[8,0,8,8],[16,0,8,8],[0,8,8,8],[8,8,8,8],[16,8,8,8],[24,8,8,8]].forEach((r) => rect(...r, skin));
// face (eyes + mouth) on front (8,8)
set(10,11,34,34,34); set(13,11,34,34,34); set(10,12,34,34,34); set(13,12,34,34,34);
rect(11,14,2,1,[160,90,74]);
// body / arms / legs base
[[20,16,8,4],[28,16,8,4],[16,20,4,12],[20,20,8,12],[28,20,4,12],[32,20,8,12]].forEach((r) => rect(...r, shirt));
[[44,16,4,4],[48,16,4,4],[40,20,4,12],[44,20,4,12],[48,20,4,12],[52,20,4,12]].forEach((r) => rect(...r, skin));
[[36,48,4,4],[40,48,4,4],[32,52,4,12],[36,52,4,12],[40,52,4,12],[44,52,4,12]].forEach((r) => rect(...r, skin));
[[4,16,4,4],[8,16,4,4],[0,20,4,12],[4,20,4,12],[8,20,4,12],[12,20,4,12]].forEach((r) => rect(...r, pants));
[[20,48,4,4],[24,48,4,4],[16,52,4,12],[20,52,4,12],[24,52,4,12],[28,52,4,12]].forEach((r) => rect(...r, pants));
// overlay HAT (hair) at offset (32,0) — opaque hair, but clear the front-lower so the face shows
[[40,0,8,8],[48,0,8,8],[32,8,8,8],[40,8,8,8],[48,8,8,8],[56,8,8,8]].forEach((r) => rect(...r, hair));
for (let y = 12; y < 16; y++) for (let x = 40; x < 48; x++) set(x, y, 0, 0, 0, 0); // open the face

// ---------- encode PNG ----------
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type, "ascii"); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; for (let x = 0; x < W * 4; x++) raw[y * (W * 4 + 1) + 1 + x] = buf[y * W * 4 + x]; }
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);

// ---------- build GLB via @skinmint/mcmodel ----------
const glb = await buildMinecraftGLB(new Uint8Array(png), { overlay: true });
console.log("GLB bytes:", glb.byteLength);
const b64 = Buffer.from(glb).toString("base64");

// ---------- render the GLB ----------
const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#0a0a0b;height:100%}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script></head><body>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const scene=new THREE.Scene();
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true}); renderer.setPixelRatio(2); renderer.setSize(700,780); document.body.appendChild(renderer.domElement);
const cam=new THREE.PerspectiveCamera(32,700/780,0.1,100); cam.position.set(2.4,1.15,4.2); cam.lookAt(0,1,0);
new GLTFLoader().load("data:model/gltf-binary;base64,${b64}", g=>{ scene.add(g.scene); renderer.render(scene,cam); window.__done=true; }, undefined, e=>{ window.__err=String(e); window.__done=true; });
</script></body></html>`;

const browser = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 700, height: 780 }, deviceScaleFactor: 1 });
await page.setContent(HTML, { waitUntil: "networkidle" });
await page.waitForFunction("window.__done===true", { timeout: 15000 }).catch(() => {});
await sleep(600);
await page.screenshot({ path: "/tmp/skinmint-shots/mc-pkg.png" });
console.log("err:", await page.evaluate(() => window.__err || "none"));
await browser.close();
