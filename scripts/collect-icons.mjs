import { writeFile } from "node:fs/promises";
const PUB = "/Users/mac/Projects/SkinMint/examples/next-demo/public/skinmint/icons";
// id -> in-game internal avatar name
const NAMES = { hutao:"Hutao", klee:"Klee", zhongli:"Zhongli", keqing:"Keqing", diluc:"Diluc", tartaglia:"Tartaglia" };
const isPng = (b) => b.length > 500 && Buffer.from(b.slice(1,4)).toString()==="PNG";
const sources = (n) => [
  `https://enka.network/ui/UI_AvatarIcon_${n}.png`,
  `https://api.ambr.top/assets/UI/UI_AvatarIcon_${n}.png`,
  `https://gi.yatta.moe/assets/UI/UI_AvatarIcon_${n}.png`,
];
for (const [id, n] of Object.entries(NAMES)) {
  let ok = false;
  for (const url of sources(n)) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const b = new Uint8Array(await r.arrayBuffer());
      if (isPng(b)) { await writeFile(`${PUB}/${id}.png`, b); console.log(id.padEnd(10), "OK", b.length+"b", "<-", new URL(url).host); ok = true; break; }
    } catch {}
  }
  if (!ok) console.log(id.padEnd(10), "FAIL all sources");
}
