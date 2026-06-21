// retrieve+recolor end-to-end (headless): cutout 立绘 → extract palette →
// buildBaseSkin → save. node scripts/recolor.mjs assets/kurumi.jpg_cut.png [neck hip hairFace]
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import { decodePNG } from "./pngdec.mjs";
import { extractColors } from "../web/projectcore.mjs";
import { buildBaseSkin } from "../web/baseskin.mjs";

const [path, neck, hip, hairFace] = process.argv.slice(2);
if (!path) { console.error("usage: node scripts/recolor.mjs <cutout.png> [neck hip hairFace]"); process.exit(1); }
const { data, width, height } = decodePNG(path);
let transparent = 0; for (let i = 3; i < data.length; i += 4) if (data[i] < 128) transparent++;
const preCut = transparent / (width * height) > 0.05;

const guides = { ...(neck ? { neck: +neck } : {}), ...(hip ? { hip: +hip } : {}), ...(hairFace ? { hairFace: +hairFace } : {}) };
const colors = extractColors(data, width, height, guides, { removeBg: !preCut });
const rgb = (c) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
console.log("extracted:", Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, rgb(v)])));

const atlas = buildBaseSkin(colors);
function crc32(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return ~c>>>0;}
function chunk(t,d){const ty=Buffer.from(t),l=Buffer.alloc(4),cc=Buffer.alloc(4);l.writeUInt32BE(d.length);cc.writeUInt32BE(crc32(Buffer.concat([ty,d])));return Buffer.concat([l,ty,d,cc]);}
const N=64,raw=Buffer.alloc(N*(1+N*4));let q=0;for(let y=0;y<N;y++){raw[q++]=0;for(let x=0;x<N*4;x++)raw[q++]=atlas[y*N*4+x];}
const ih=Buffer.alloc(13);ih.writeUInt32BE(N,0);ih.writeUInt32BE(N,4);ih[8]=8;ih[9]=6;
const out=`out/${basename(path,".png")}.recolor.png`;
writeFileSync(out,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",ih),chunk("IDAT",deflateSync(raw)),chunk("IEND",Buffer.alloc(0))]));
console.log("wrote",out);
