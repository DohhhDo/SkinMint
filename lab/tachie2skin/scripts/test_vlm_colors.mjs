import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { basename } from "node:path";
import { loadEnv } from "../src/env.mjs";
import { extractColorsVLM } from "../src/vision.mjs";
import { buildBaseSkin } from "../web/baseskin.mjs";

const path = process.argv[2] || "assets/kurumi.jpg";
const env = loadEnv();
const mime = path.endsWith(".png") ? "image/png" : "image/jpeg";
console.log("asking VLM for colors…");
const v = await extractColorsVLM(new Uint8Array(readFileSync(path)), env.HF_TOKEN, { mime });
const rgb = (c) => c ? `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}` : "—";
console.log("VLM colors:", Object.fromEntries(Object.entries(v).map(([k, c]) => [k, rgb(c)])));

const colors = {
  hair: v.hair, skin: v.skin, top: v.top, bottom: v.bottom,
  accent: v.accent ?? v.eyes, eye: v.eyes ?? v.accent,
  shoe: (v.bottom ?? [40, 40, 50]).map((x) => Math.round(x * 0.55)),
};
const atlas = buildBaseSkin(colors);
function crc32(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return ~c>>>0;}
function chunk(t,d){const ty=Buffer.from(t),l=Buffer.alloc(4),cc=Buffer.alloc(4);l.writeUInt32BE(d.length);cc.writeUInt32BE(crc32(Buffer.concat([ty,d])));return Buffer.concat([l,ty,d,cc]);}
const N=64,raw=Buffer.alloc(N*(1+N*4));let q=0;for(let y=0;y<N;y++){raw[q++]=0;for(let x=0;x<N*4;x++)raw[q++]=atlas[y*N*4+x];}
const ih=Buffer.alloc(13);ih.writeUInt32BE(N,0);ih.writeUInt32BE(N,4);ih[8]=8;ih[9]=6;
const out=`out/${basename(path).replace(/\.[^.]+$/,"")}.vlm.png`;
writeFileSync(out,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",ih),chunk("IDAT",deflateSync(raw)),chunk("IEND",Buffer.alloc(0))]));
console.log("wrote",out);
