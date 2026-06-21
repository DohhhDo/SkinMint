import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "./../examples/next-demo/node_modules/pngjs/lib/png.js";
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from "@huggingface/transformers";
env.allowLocalModels = false;

// front faces (UV rects) → paper-doll layout, scaled 8x
const FRONT = { head:[8,8,8,8], rarm:[44,20,4,12], body:[20,20,8,12], larm:[36,52,4,12], rleg:[4,20,4,12], lleg:[20,52,4,12] };
const POS = { head:[4,0], rarm:[0,8], body:[4,8], larm:[12,8], rleg:[4,20], lleg:[8,20] };
function paperDoll(skinBuf) {
  const png = PNG.sync.read(skinBuf); const sd = png.data, SW = png.width;
  const S = 8, W = 16*S, H = 32*S;
  const out = new PNG({ width: W, height: H });
  out.data.fill(255); // white bg
  const put = (sx,sy,sw,sh,dx,dy) => { for(let j=0;j<sh;j++)for(let i=0;i<sw;i++){const si=((sy+j)*SW+(sx+i))*4;const a=sd[si+3];for(let yy=0;yy<S;yy++)for(let xx=0;xx<S;xx++){const di=(((dy+j)*S+yy)*W+((dx+i)*S+xx))*4;if(a<40){out.data[di]=255;out.data[di+1]=255;out.data[di+2]=255;out.data[di+3]=255;}else{out.data[di]=sd[si];out.data[di+1]=sd[si+1];out.data[di+2]=sd[si+2];out.data[di+3]=255;}}}};
  for (const k of Object.keys(FRONT)) { const [sx,sy,sw,sh]=FRONT[k]; const [dx,dy]=POS[k]; put(sx,sy,sw,sh,dx,dy); }
  return PNG.sync.write(out);
}

console.log("loading CLIP (first run downloads ~350MB)…");
const processor = await AutoProcessor.from_pretrained("Xenova/clip-vit-base-patch32");
const model = await CLIPVisionModelWithProjection.from_pretrained("Xenova/clip-vit-base-patch32");
async function embedFile(path){ const img = await RawImage.read(path); const inp = await processor(img); const { image_embeds } = await model(inp); const v = image_embeds.data; let n=0; for(const x of v)n+=x*x; n=Math.sqrt(n); return Array.from(v).map(x=>x/n); }
const cos = (a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);

// build paper-dolls for klee-match(yellow), cyberpunk-match(blue), a random
const cands = { yellow_skin:"30eba45d-c03b-4697-8d06-63e1f943614d", blue_skin:"4129638a-8503-49e9-b376-d86a8f1f4222", keqing_skin:"1a413cf6-681d-4f43-ad2d-dd170d586432" };
const embCand = {};
for (const [k,id] of Object.entries(cands)) { writeFileSync(`/tmp/pd-${k}.png`, paperDoll(readFileSync(`/tmp/skin-lib/${id}.png`))); embCand[k] = await embedFile(`/tmp/pd-${k}.png`); }
const klee = await embedFile("/tmp/skinmint-bench/klee.png");
const cyber = await embedFile("/tmp/skinmint-shots/p1-portrait.png");
console.log("\ncosine(klee立绘  , …):"); for(const k in embCand) console.log("  ", k, cos(klee, embCand[k]).toFixed(3));
console.log("cosine(cyber立绘 , …):"); for(const k in embCand) console.log("  ", k, cos(cyber, embCand[k]).toFixed(3));
