import { readFileSync, existsSync, readdirSync } from "node:fs";
import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
import { PNG } from "./../examples/next-demo/node_modules/pngjs/lib/png.js";
import { buildMinecraftGLB } from "../packages/mcmodel/dist/index.js";

// base library = the curated 56 (all verified-good, detailed human skins)
const SKINS = "examples/next-demo/public/skinmint/skins";
const isSk = (r,g,b)=>{const mx=Math.max(r,g,b),mn=Math.min(r,g,b);return r>=g&&g>=b-8&&r-b>=16&&r-b<=95&&mx>=150&&mx<=252&&mx-mn>=12&&mx-mn<=100;};
function featOf(buf){ const png=PNG.sync.read(buf),d=png.data,W=png.width; const at=(x,y)=>{const i=(y*W+x)*4;return[d[i],d[i+1],d[i+2],d[i+3]];}; const dom=(x0,y0,w,h,so,ns)=>{const m=new Map();for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){const[r,g,b,a]=at(x,y);if(a<40)continue;if(so&&!isSk(r,g,b))continue;if(ns&&isSk(r,g,b))continue;const k=((r>>4)<<8)|((g>>4)<<4)|(b>>4);const e=m.get(k)||[0,0,0,0];e[0]+=r;e[1]+=g;e[2]+=b;e[3]++;m.set(k,e);}let bs=null;for(const e of m.values())if(!bs||e[3]>bs[3])bs=e;return bs?[bs[0]/bs[3],bs[1]/bs[3],bs[2]/bs[3]]:null;}; return {skin:dom(8,8,8,8,1,0)||dom(44,20,4,12,1,0)||[240,210,190],hair:dom(8,0,8,8,0,1)||[60,45,40],top:dom(20,20,8,12,0,1)||[120,120,130],bottom:dom(4,20,4,12,0,1)||[60,60,70]}; }
const index = readdirSync(SKINS).filter(f=>f.endsWith(".png")).map(f=>{ try{ return { id:f.replace(".png",""), path:`${SKINS}/${f}`, f:featOf(readFileSync(`${SKINS}/${f}`)) }; }catch{return null;} }).filter(Boolean);
console.log("curated base library:", index.length, "skins");
const QUERIES = [["cyberpunk","/tmp/skinmint-shots/p1-portrait.png"],["klee","/tmp/skinmint-bench/klee.png"],["hutao","/tmp/skinmint-bench/hutao.png"],["keqing","/tmp/skinmint-bench/keqing.png"]];

// --- color helpers ---
const hx2 = (h) => { const n = parseInt(h.replace("#",""),16); return [(n>>16)&255,(n>>8)&255,n&255]; };
const rgb2hsv = (r,g,b) => { r/=255;g/=255;b/=255; const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn; let h=0; if(d){ if(mx===r)h=((g-b)/d)%6; else if(mx===g)h=(b-r)/d+2; else h=(r-g)/d+4; h*=60; if(h<0)h+=360;} return [h, mx?d/mx:0, mx]; };
const hsv2rgb = (h,s,v) => { const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c; let r,g,b; if(h<60)[r,g,b]=[c,x,0]; else if(h<120)[r,g,b]=[x,c,0]; else if(h<180)[r,g,b]=[0,c,x]; else if(h<240)[r,g,b]=[0,x,c]; else if(h<300)[r,g,b]=[x,0,c]; else [r,g,b]=[c,0,x]; return [(r+m)*255,(g+m)*255,(b+m)*255]; };
const dist = (a,b) => (a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;

// recolor: classify each pixel to nearest source-region color, remap toward target (hue replace + additive S/V shift, preserving shading)
function recolor(skinBuf, src, tgt) {
  const png = PNG.sync.read(skinBuf), d = png.data;
  const classes = ["skin","hair","top","bottom"].filter(k=>src[k]&&tgt[k]);
  const sH = {}, tH = {}, sRGB = {};
  for (const k of classes){ sRGB[k]=src[k]; sH[k]=rgb2hsv(...src[k]); tH[k]=rgb2hsv(...hx2(tgt[k])); }
  for (let i=0;i<d.length;i+=4){ if(d[i+3]<40) continue; const p=[d[i],d[i+1],d[i+2]];
    let bk=classes[0],bd=1e9; for(const k of classes){const dd=dist(p,sRGB[k]); if(dd<bd){bd=dd;bk=k;}}
    const [ph,ps,pv]=rgb2hsv(...p); const s=sH[bk],t=tH[bk];
    const nh=t[0], ns=Math.max(0,Math.min(1,ps+(t[1]-s[1]))), nv=Math.max(0,Math.min(1,pv+(t[2]-s[2])));
    const [r,g,b]=hsv2rgb(nh,ns,nv); d[i]=r;d[i+1]=g;d[i+2]=b;
  }
  return PNG.sync.write(png);
}

// browser sampler (立绘 → target palette hex)
const SAMPLE = async (src) => { const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=src;});const W=192,H=Math.max(1,Math.round(192*img.height/img.width));const cv=document.createElement("canvas");cv.width=W;cv.height=H;cv.getContext("2d").drawImage(img,0,0,W,H);const d=cv.getContext("2d").getImageData(0,0,W,H).data;const A=(x,y)=>{const i=(y*W+x)*4;return[d[i],d[i+1],d[i+2],d[i+3]];};const sat=(r,g,b)=>Math.max(r,g,b)-Math.min(r,g,b);const isBG=(r,g,b,a)=>a<40||(Math.min(r,g,b)>228&&sat(r,g,b)<16);const isSkin=(r,g,b)=>{const mx=Math.max(r,g,b),mn=Math.min(r,g,b);return r>=g&&g>=b-8&&r-b>=16&&r-b<=95&&mx>=175&&mx<=252&&mx-mn>=14&&mx-mn<=95;};const hex=c=>"#"+c.map(v=>Math.round(v).toString(16).padStart(2,"0")).join("");const mode=a=>{if(!a.length)return null;const m=new Map();for(const[r,g,b]of a){const k=((r>>4)<<8)|((g>>4)<<4)|(b>>4);const e=m.get(k)||[0,0,0,0];e[0]+=r;e[1]+=g;e[2]+=b;e[3]++;m.set(k,e);}let bs=null;for(const e of m.values())if(!bs||e[3]>bs[3])bs=e;return[bs[0]/bs[3],bs[1]/bs[3],bs[2]/bs[3]];};let mnY=H,mxY=0,mnX=W,mxX=0,any=false;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const[r,g,b,a]=A(x,y);if(!isBG(r,g,b,a)){any=true;if(y<mnY)mnY=y;if(y>mxY)mxY=y;if(x<mnX)mnX=x;if(x>mxX)mxX=x;}}if(!any){mnY=0;mxY=H-1;mnX=0;mxX=W-1;}const ch=mxY-mnY+1;const reg=(f0,f1)=>{const a=[];for(let y=(mnY+f0*ch)|0;y<(mnY+f1*ch)|0;y++)for(let x=mnX;x<=mxX;x++){const[r,g,b,al]=A(x,y);if(isBG(r,g,b,al)||isSkin(r,g,b))continue;a.push([r,g,b]);}return a;};const sp=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const[r,g,b,a]=A(x,y);if(a>=40&&isSkin(r,g,b))sp.push([r,g,b]);}const c=a=>{const m=mode(a);return m?hex(m):null;};return{skin:c(sp),hair:c(reg(0,0.2)),top:c(reg(0.22,0.46)),bottom:c(reg(0.52,0.82))};};
const nearest = (q) => { let best=null,bd=1e18; for(const e of index){ const d=1.0*dist(hx2(q.skin),e.f.skin)+1.6*dist(hx2(q.hair),e.f.hair)+1.6*dist(hx2(q.top),e.f.top)+0.7*dist(hx2(q.bottom),e.f.bottom); if(d<bd){bd=d;best=e;} } return best; };

const browser = await chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const pj = await browser.newPage();
const rows=[];
for (const [name,path] of QUERIES) {
  if(!existsSync(path))continue;
  const b64=readFileSync(path).toString("base64");
  const q=await pj.evaluate(SAMPLE, "data:image/png;base64,"+b64);
  const m=nearest(q);
  const retrievedBuf=readFileSync(m.path);
  const recoloredBuf=recolor(retrievedBuf, m.f, q);
  const glb=Buffer.from(await buildMinecraftGLB(new Uint8Array(recoloredBuf),{overlay:true})).toString("base64");
  rows.push({name,portrait:b64,retrieved:retrievedBuf.toString("base64"),recolored:recoloredBuf.toString("base64"),glb});
  console.log(name,"target",JSON.stringify(q),"→",m.id);
}
const HTML=`<!DOCTYPE html><html><head><meta charset=utf-8><style>html,body{margin:0;background:#f1ead9;font-family:monospace}table{border-collapse:collapse;margin:8px}td{text-align:center;padding:5px;border-bottom:1px solid #ccc}th{font-size:12px}img{height:180px;border:1px solid #999;border-radius:6px}img.sk{height:96px;image-rendering:pixelated}.vp{width:170px;height:210px}</style><script type=importmap>{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script></head><body>
<table><tr><th>输入立绘</th><th>检索到的(人工)</th><th>重上色后</th><th>模型</th></tr>
${rows.map(r=>`<tr><td><img src="data:image/png;base64,${r.portrait}"></td><td><img class=sk src="data:image/png;base64,${r.retrieved}"></td><td><img class=sk src="data:image/png;base64,${r.recolored}"></td><td><div class=vp data-glb="${r.glb}"></div></td></tr>`).join("")}</table>
<script type=module>import * as THREE from "three";import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";for(const el of document.querySelectorAll(".vp")){const w=el.clientWidth,h=el.clientHeight;const sc=new THREE.Scene();const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});r.setPixelRatio(2);r.setSize(w,h);const cam=new THREE.PerspectiveCamera(30,w/h,.1,100);cam.position.set(2.3,1.1,4.6);cam.lookAt(0,1.05,0);await new Promise(d=>{new GLTFLoader().load("data:model/gltf-binary;base64,"+el.dataset.glb,g=>{sc.add(g.scene);r.render(sc,cam);const im=new Image();im.width=w;im.height=h;im.src=r.domElement.toDataURL();el.replaceWith(im);r.dispose();r.forceContextLoss();d();},undefined,()=>d())});}window.__done=1;</script></body></html>`;
const p=await browser.newPage({viewport:{width:700,height:1100},deviceScaleFactor:1.4});await p.setContent(HTML,{waitUntil:"networkidle"});await p.waitForFunction("window.__done===1",{timeout:30000}).catch(()=>{});await sleep(800);await p.screenshot({path:"/tmp/skinmint-shots/recolor.png",fullPage:true});await browser.close();console.log("→ recolor.png");
