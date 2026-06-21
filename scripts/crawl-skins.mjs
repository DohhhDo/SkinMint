import { writeFile } from "node:fs/promises";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const PUB = "/Users/mac/Projects/SkinMint/examples/next-demo/public/skinmint/skins";
const get = (u) => fetch(u, { headers: { "User-Agent": UA, Referer: "https://mcskins.top/" } });
const seeds = ["hutao-genshinimpact","zhongli-genshinimpact","keqing-genshinimpact","genshinimpact-diluc","tartaglia-genshinimpact","klee-genshinimpact","genshinimpact-xingqiu","genshinimpact-aether"];
const slugs = new Set(seeds);
// BFS 2 levels to collect more genshin slugs
let frontier = [...seeds];
for (let depth = 0; depth < 2; depth++) {
  const next = [];
  for (const s of frontier) {
    try {
      const html = await (await get(`https://mcskins.top/skin/${s}`)).text();
      for (const m of html.matchAll(/\/skin\/([a-z0-9-]*genshin[a-z0-9-]*)/g)) {
        if (!slugs.has(m[1])) { slugs.add(m[1]); next.push(m[1]); }
      }
    } catch {}
  }
  frontier = next;
  if (slugs.size > 60) break;
}
console.log("OUT collected slugs:", slugs.size);
// download each skin's image
const isPng = (b) => b.length > 800 && Buffer.from(b.slice(1,4)).toString()==="PNG";
const ok = [];
for (const s of slugs) {
  try {
    const html = await (await get(`https://mcskins.top/skin/${s}`)).text();
    const m = html.match(/assets\/images\/skin\/([a-z0-9-]+\.png)/);
    if (!m) continue;
    const b = new Uint8Array(await (await get(`https://mcskins.top/${m[0]}`)).arrayBuffer());
    if (!isPng(b)) continue;
    // character key = slug with genshinimpact stripped
    const key = s.replace(/-?genshinimpact-?/g, "").replace(/-/g,"");
    if (!key) continue;
    await writeFile(`${PUB}/${key}.png`, b);
    ok.push(key);
  } catch {}
}
console.log("OUT downloaded:", ok.sort().join(", "));
