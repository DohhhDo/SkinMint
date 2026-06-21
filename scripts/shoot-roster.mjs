import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1240, height: 800 }, deviceScaleFactor: 1 });
await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await sleep(1000);
await p.locator(".face").nth(3).click(); await sleep(500); // select one to show ring
await p.screenshot({ path: "/tmp/skinmint-shots/roster.png" });
// also crop the panel for a closer look
const panel = p.locator(".panel");
await panel.screenshot({ path: "/tmp/skinmint-shots/roster-panel.png" });
await b.close(); console.log("ok");
