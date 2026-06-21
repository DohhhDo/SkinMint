import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";

const OUT = "/tmp/skinmint-shots";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1240, height: 860 }, deviceScaleFactor: 1.5 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push("c:" + m.text()); });

await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await sleep(600);

// step 1: pick a character → 2D preview
await page.locator(".wz-char").first().click();
await sleep(700);
await page.screenshot({ path: `${OUT}/w2-1-preview2d.png` });

// step 2: 造型
await page.locator(".wz-next").click();
await sleep(600);
await page.getByText("Q 版", { exact: true }).click();
await page.getByText("带底座", { exact: true }).click();
await sleep(500);

// step 3: 动作 → choose 行走
await page.locator(".wz-next").click();
await sleep(600);
await page.getByText("行走", { exact: true }).click();
await sleep(400);
await page.screenshot({ path: `${OUT}/w2-3-act.png` });

// generate — capture the building moment
await page.locator(".wz-next.gen").click();
await sleep(350);
await page.screenshot({ path: `${OUT}/w2-4-building.png` });

// wait for result phase (living model)
await page.waitForFunction(() => document.querySelector(".wz-result-tag") && !document.querySelector(".wz-building"), { timeout: 20000 }).catch(() => {});
await sleep(1800); // let the walk animation run
await page.screenshot({ path: `${OUT}/w2-5-result-walk-a.png` });
await sleep(450); // a beat later — limbs should be in a different position
await page.screenshot({ path: `${OUT}/w2-5-result-walk-b.png` });

// switch action live → 挥手 (no rebuild)
await page.getByText("挥手", { exact: true }).click();
await sleep(1400);
await page.screenshot({ path: `${OUT}/w2-6-result-wave.png` });

await browser.close();
console.log("errors:", errs.slice(0, 8));
