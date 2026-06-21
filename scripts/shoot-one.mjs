import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
const browser = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 760, height: 720 }, deviceScaleFactor: 1 });
await page.setContent(`<body style="margin:0;background:#0a0a0b"><script src="http://localhost:3000/skinmint-embed.global.js"></script><skinmint-model src="${process.env.U}" auto-rotate style="width:760px;height:720px"></skinmint-model></body>`);
await sleep(9000);
await page.screenshot({ path: "/tmp/skinmint-shots/raiden-name.png" });
await browser.close();
console.log("shot done");
