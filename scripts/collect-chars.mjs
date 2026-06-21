import { readFile, writeFile, copyFile } from "node:fs/promises";
const ROOT = "/Users/mac/Projects/SkinMint";
const PUB = `${ROOT}/examples/next-demo/public/skinmint`;
// id -> { skin file in /tmp/mcskins, genshin api key }
const CHARS = [
  { id: "hutao", key: "hu-tao" },
  { id: "klee", key: "klee" },
  { id: "zhongli", key: "zhongli" },
  { id: "keqing", key: "keqing" },
  { id: "diluc", key: "diluc" },
  { id: "tartaglia", key: "tartaglia" },
];
const isPng = (b) => b.length > 500 && Buffer.from(b.slice(1, 4)).toString() === "PNG";
for (const c of CHARS) {
  // skin: copy from /tmp/mcskins
  try { await copyFile(`/tmp/mcskins/${c.id}.png`, `${PUB}/skins/${c.id}.png`); } catch (e) { console.log(c.id, "skin copy fail", e.message); }
  // icon: try genshin.jmp.blue icon-big then icon
  let iconOk = false;
  for (const path of ["icon-big", "icon"]) {
    try {
      const r = await fetch(`https://genshin.jmp.blue/characters/${c.key}/${path}`);
      if (!r.ok) continue;
      const b = new Uint8Array(await r.arrayBuffer());
      if (isPng(b)) { await writeFile(`${PUB}/icons/${c.id}.png`, b); iconOk = true; break; }
    } catch {}
  }
  console.log(c.id.padEnd(10), "skin:ok", "icon:" + (iconOk ? "ok" : "FAIL"));
}
