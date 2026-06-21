import { writeFile } from "node:fs/promises";
const PUB = "/Users/mac/Projects/SkinMint/examples/next-demo/public/skinmint/icons";
// id -> { zh, enka internal name }
const CHARS = {
  hutao:["胡桃","Hutao"], klee:["可莉","Klee"], zhongli:["钟离","Zhongli"], keqing:["刻晴","Keqing"],
  diluc:["迪卢克","Diluc"], tartaglia:["达达利亚","Tartaglia"], ganyu:["甘雨","Ganyu"], kazuha:["枫原万叶","Kazuha"],
  xiao:["魈","Xiao"], venti:["温迪","Venti"], xingqiu:["行秋","Xingqiu"], xiangling:["香菱","Xiangling"],
  qiqi:["七七","Qiqi"], albedo:["阿贝多","Albedo"], amber:["安柏","Ambor"], beidou:["北斗","Beidou"],
  bennett:["班尼特","Bennett"], chongyun:["重云","Chongyun"], jean:["琴","Qin"], noelle:["诺艾尔","Noel"],
  razor:["雷泽","Razor"], sucrose:["砂糖","Sucrose"], aether:["空","PlayerBoy"], lumine:["荧","PlayerGirl"],
  paimon:["派蒙","Paimon"],
};
const isPng = (b) => b.length > 500 && Buffer.from(b.slice(1,4)).toString()==="PNG";
const ready = [];
for (const [id, [zh, n]] of Object.entries(CHARS)) {
  let ok = false;
  for (const url of [`https://enka.network/ui/UI_AvatarIcon_${n}.png`, `https://gi.yatta.moe/assets/UI/UI_AvatarIcon_${n}.png`]) {
    try { const r = await fetch(url); if (!r.ok) continue; const b = new Uint8Array(await r.arrayBuffer());
      if (isPng(b)) { await writeFile(`${PUB}/${id}.png`, b); ok = true; break; } } catch {}
  }
  if (ok) ready.push([id, zh]);
  else console.log("ICON FAIL:", id, n);
}
console.log("READY", JSON.stringify(ready));
