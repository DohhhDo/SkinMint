// Build a base skin from hardcoded colors and save it (then render3d to verify).
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { buildBaseSkin } from "../web/baseskin.mjs";

const colors = {
  hair: [28, 24, 30], skin: [242, 226, 214], top: [32, 34, 48],
  bottom: [55, 70, 150], accent: [200, 40, 52], eye: [205, 35, 45], shoe: [20, 20, 24],
};
const atlas = buildBaseSkin(colors);

function crc32(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return ~c>>>0;}
function chunk(t,d){const ty=Buffer.from(t),l=Buffer.alloc(4),cc=Buffer.alloc(4);l.writeUInt32BE(d.length);cc.writeUInt32BE(crc32(Buffer.concat([ty,d])));return Buffer.concat([l,ty,d,cc]);}
const N=64,raw=Buffer.alloc(N*(1+N*4));let q=0;for(let y=0;y<N;y++){raw[q++]=0;for(let x=0;x<N*4;x++)raw[q++]=atlas[y*N*4+x];}
const ih=Buffer.alloc(13);ih.writeUInt32BE(N,0);ih.writeUInt32BE(N,4);ih[8]=8;ih[9]=6;
writeFileSync("out/base_kurumi.skin.png",Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",ih),chunk("IDAT",deflateSync(raw)),chunk("IEND",Buffer.alloc(0))]));
console.log("wrote out/base_kurumi.skin.png");
