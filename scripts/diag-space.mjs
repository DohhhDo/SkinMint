const SPACE="https://nick088-minecraft-skin-generator.hf.space";
async function call(prompt){
  const data=[prompt,"xl",22,7.5,"fp16",Math.floor(Math.random()*2e9),"skin.png",false,false];
  const post=await fetch(`${SPACE}/gradio_api/call/predict`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data})});
  const j=await post.json();
  console.log("  POST status",post.status,"event_id",j.event_id);
  if(!j.event_id){console.log("  POST body:",JSON.stringify(j).slice(0,300));return;}
  const t=await (await fetch(`${SPACE}/gradio_api/call/predict/${j.event_id}`)).text();
  console.log("  SSE len",t.length,"| events:", [...t.matchAll(/event:\s*(\w+)/g)].map(m=>m[1]).join(","));
  console.log("  SSE tail:", JSON.stringify(t.slice(-300)));
}
console.log("=== long builder prompt ===");
await call("Ganyu, Genshin Impact, small feathered wings on the back, voxel art, blocky cubic style, pixelated low resolution, flat solid colors, Minecraft-like, full body, single character, plain background, game asset, 3D model");
console.log("=== clean prompt 'Ganyu' ===");
await call("Ganyu");
