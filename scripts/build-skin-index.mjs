import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PNG } from "../examples/next-demo/node_modules/pngjs/lib/png.js";

const env = Object.fromEntries(readFileSync("examples/next-demo/.env.local","utf8").split("\n").filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const TOK = env.HF_TOKEN;
const LIB = "/tmp/skin-lib"; mkdirSync(LIB, { recursive: true });
const PAGES = 40, PER = 100; // ~4000 skins

const sat = (r,g,b)=>Math.max(r,g,b)-Math.min(r,g,b);
const isSkin=(r,g,b)=>{const mx=Math.max(r,g,b),mn=Math.min(r,g,b);return r>=g&&g>=b-8&&r-b>=16&&r-b<=95&&mx>=150&&mx<=252&&mx-mn>=12&&mx-mn<=100;};
function feat(png){ // 64x64 RGBA → {skin,hair,top,bottom} as [r,g,b]
  const d=png.data, W=png.width;
  const at=(x,y)=>{const i=(y*W+x)*4;return [d[i],d[i+1],d[i+2],d[i+3]];};
  const dom=(x0,y0,w,h,skinOnly,notSkin)=>{const m=new Map();for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){const[r,g,b,a]=at(x,y);if(a<40)continue;if(skinOnly&&!isSkin(r,g,b))continue;if(notSkin&&isSkin(r,g,b))continue;const k=((r>>4)<<8)|((g>>4)<<4)|(b>>4);const e=m.get(k)||[0,0,0,0];e[0]+=r;e[1]+=g;e[2]+=b;e[3]++;m.set(k,e);}let best=null;for(const e of m.values())if(!best||e[3]>best[3])best=e;return best?[best[0]/best[3],best[1]/best[3],best[2]/best[3]]:null;};
  const skin = dom(8,8,8,8,true,false) || dom(44,20,4,12,true,false) || [240,210,190];
  const hair = dom(8,0,8,8,false,true) || dom(8,8,8,2,false,true) || [60,45,40];
  const top  = dom(20,20,8,12,false,true) || [120,120,130];
  const bottom = dom(4,20,4,12,false,true) || [60,60,70];
  return { skin, hair, top, bottom };
}

const index = [];
for (let p=0; p<PAGES; p++) {
  const url=`https://datasets-server.huggingface.co/rows?dataset=nyuuzyou/Minecraft-Skins-20M&config=default&split=train&offset=${p*PER}&length=${PER}`;
  const res = await fetch(url, { headers: { Authorization:`Bearer ${TOK}` }});
  if(!res.ok){ console.log("page",p,"HTTP",res.status); continue; }
  const j = await res.json();
  for (const r of j.rows||[]) {
    try {
      const id = r.row.id; const b64 = r.row.image;
      const buf = Buffer.from(b64,"base64");
      const png = PNG.sync.read(buf);
      if (png.width!==64 || png.height!==64) continue;
      writeFileSync(`${LIB}/${id}.png`, buf);
      index.push({ id, f: feat(png) });
    } catch {}
  }
  if(p%10===9) console.log("indexed", index.length);
}
writeFileSync("/tmp/skin-index.json", JSON.stringify(index));
console.log("DONE: indexed", index.length, "skins → /tmp/skin-index.json");
