import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1240, height: 820 }, deviceScaleFactor: 1.4 });
const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
await p.goto("http://localhost:3000/", { waitUntil: "networkidle" }); await sleep(900);
await p.getByText("热门", { exact: true }).click(); await sleep(600);
await p.screenshot({ path: "/tmp/skinmint-shots/anime-roster.png" });
await b.close(); console.log("errors:", errs.slice(0,4));
