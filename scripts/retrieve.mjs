import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
import { buildMinecraftGLB } from "../packages/mcmodel/dist/index.js";

const index = JSON.parse(readFileSync("/tmp/skin-index.json","utf8"));
console.log("library:", index.length, "skins");
const QUERIES = [
  ["hutao","/tmp/skinmint-bench/hutao.png"], ["klee","/tmp/skinmint-bench/klee.png"],
  ["keqing","/tmp/skinmint-bench/keqing.png"], ["diluc","/tmp/skinmint-bench/diluc.png"],
  ["cyberpunk","/tmp/skinmint-shots/p1-portrait.png"],
];

// browser sampler → {skin,hair,top,bottom} rgb (same as app/_lib/sampleColors)
const SAMPLE = async (src) => {
  const img=new Image(); await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=src;});
  const W=192,H=Math.max(1,Math.round(192*img.height/img.width));const cv=document.createElement("canvas");cv.width=W;cv.height=H;cv.getContext("2d").drawImage(img,0,0,W,H);const d=cv.getContext("2d").getImageData(0,0,W,H).data;
  const A=(x,y)=>{const i=(y*W+x)*4;return [d[i],d[i+1],d[i+2],d[i+3]];};const sat=(r,g,b)=>Math.max(r,g,b)-Math.min(r,g,b);
  const isBG=(r,g,b,a)=>a<40||(Math.min(r,g,b)>228&&sat(r,g,b)<16);const isSkin=(r,g,b)=>{const mx=Math.max(r,g,b),mn=Math.min(r,g,b);return r>=g&&g>=b-8&&r-b>=16&&r-b<=95&&mx>=175&&mx<=252&&mx-mn>=14&&mx-mn<=95;};
  const mode=a=>{if(!a.length)return null;const m=new Map();for(const[r,g,b]of a){const k=((r>>4)<<8)|((g>>4)<<4)|(b>>4);const e=m.get(k)||[0,0,0,0];e[0]+=r;e[1]+=g;e[2]+=b;e[3]++;m.set(k,e);}let best=null;for(const e of m.values())if(!best||e[3]>best[3])best=e;return [best[0]/best[3],best[1]/best[3],best[2]/best[3]];};
  let minY=H,maxY=0,minX=W,maxX=0,any=false;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const[r,g,b,a]=A(x,y);if(!isBG(r,g,b,a)){any=true;if(y<minY)minY=y;if(y>maxY)maxY=y;if(x<minX)minX=x;if(x>maxX)maxX=x;}}if(!any){minY=0;maxY=H-1;minX=0;maxX=W-1;}const ch=maxY-minY+1;
  const reg=(f0,f1)=>{const a=[];for(let y=(minY+f0*ch)|0;y<(minY+f1*ch)|0;y++)for(let x=minX;x<=maxX;x++){const[r,g,b,al]=A(x,y);if(isBG(r,g,b,al)||isSkin(r,g,b))continue;a.push([r,g,b]);}return a;};
  const sp=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const[r,g,b,a]=A(x,y);if(a>=40&&isSkin(r,g,b))sp.push([r,g,b]);}
  return {skin:mode(sp),hair:mode(reg(0,0.2)),top:mode(reg(0.22,0.46)),bottom:mode(reg(0.52,0.82))};
};
const dist=(a,b)=>a&&b?((a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2):3*255*255;
function nearest(q){ let best=null,bd=1e18; for(const e of index){ const d=1.0*dist(q.skin,e.f.skin)+1.6*dist(q.hair,e.f.hair)+1.6*dist(q.top,e.f.top)+0.7*dist(q.bottom,e.f.bottom); if(d<bd){bd=d;best=e;} } return best; }

const browser = await chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const pj = await browser.newPage();
const rows=[];
for (const [name, path] of QUERIES) {
  if(!existsSync(path)){console.log("skip",name);continue;}
  const b64 = readFileSync(path).toString("base64");
  const q = await pj.evaluate(SAMPLE, "data:image/png;base64,"+b64);
  const m = nearest(q);
  const skinB64 = readFileSync(`/tmp/skin-lib/${m.id}.png`).toString("base64");
  const glb = Buffer.from(await buildMinecraftGLB(new Uint8Array(readFileSync(`/tmp/skin-lib/${m.id}.png`)), {overlay:true})).toString("base64");
  rows.push({name, portrait:b64, skin:skinB64, glb});
  console.log(name,"→ matched",m.id);
}
const vp=b=>`<div class="vp" data-glb="${b}" style="width:170px;height:210px"></div>`;
const HTML=`<!DOCTYPE html><html><head><meta charset=utf-8><style>html,body{margin:0;background:#f1ead9;font-family:monospace}table{border-collapse:collapse;margin:8px}td{text-align:center;padding:4px;border-bottom:1px solid #ccc}th{font-size:12px}.lbl{font-weight:700}img{height:180px;border:1px solid #999;border-radius:6px}img.sk{height:80px;image-rendering:pixelated}</style>
<script type=importmap>{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script></head><body>
<table><tr><th>查询立绘</th><th>检索到的人工皮肤</th><th>模型</th></tr>
${rows.map(r=>`<tr><td><div class=lbl>${r.name}</div><img src="data:image/png;base64,${r.portrait}"></td><td><img class=sk src="data:image/png;base64,${r.skin}"></td><td>${vp(r.glb)}</td></tr>`).join("")}</table>
<script type=module>import * as THREE from "three";import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";for(const el of document.querySelectorAll(".vp")){const w=el.clientWidth,h=el.clientHeight;const sc=new THREE.Scene();const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});r.setPixelRatio(2);r.setSize(w,h);const cam=new THREE.PerspectiveCamera(30,w/h,.1,100);cam.position.set(2.3,1.1,4.6);cam.lookAt(0,1.05,0);await new Promise(d=>{new GLTFLoader().load("data:model/gltf-binary;base64,"+el.dataset.glb,g=>{sc.add(g.scene);r.render(sc,cam);const im=new Image();im.width=w;im.height=h;im.src=r.domElement.toDataURL();el.replaceWith(im);r.dispose();r.forceContextLoss();d();},undefined,()=>d())});}window.__done=1;</script></body></html>`;
const p=await browser.newPage({viewport:{width:600,height:1300},deviceScaleFactor:1.4});
await p.setContent(HTML,{waitUntil:"networkidle"});await p.waitForFunction("window.__done===1",{timeout:30000}).catch(()=>{});await sleep(800);
await p.screenshot({path:"/tmp/skinmint-shots/retrieve.png",fullPage:true});await browser.close();console.log("→ retrieve.png");
