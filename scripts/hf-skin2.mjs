import { buildMinecraftGLB } from "/Users/mac/Projects/SkinMint/packages/mcmodel/dist/index.js";
import { writeFile } from "node:fs/promises";
const SPACE="https://nick088-minecraft-skin-generator.hf.space";
const prompt=process.env.PROMPT;
const data=[prompt,"xl",35,7.5,"fp16",Math.floor(Math.random()*2e9),"skin.png",false,false];
const { event_id }=await (await fetch(`${SPACE}/gradio_api/call/predict`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data})})).json();
const text=await (await fetch(`${SPACE}/gradio_api/call/predict/${event_id}`)).text();
let result=null; for(const l of text.split("\n")){ if(l.startsWith("data:")){ try{const v=JSON.parse(l.slice(5).trim()); if(Array.isArray(v)&&v[0])result=v;}catch{} } }
let u=result[0].url||result[0].path; if(u&&!u.startsWith("http"))u=`${SPACE}/gradio_api/file=${u}`;
const png=new Uint8Array(await (await fetch(u)).arrayBuffer());
await writeFile("/tmp/hf-skin2.png",png);
await writeFile("/tmp/hf-skin2.glb", await buildMinecraftGLB(png,{overlay:true}));
console.log("OUT done skin bytes",png.byteLength);
