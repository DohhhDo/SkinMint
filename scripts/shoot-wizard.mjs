import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";

const OUT = "/tmp/skinmint-shots";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1240, height: 860 }, deviceScaleFactor: 1.5 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });

await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await sleep(700);
await page.screenshot({ path: `${OUT}/wz-0-empty.png` });

// step 1 — pick a character (Hu Tao = first card)
await page.locator(".wz-char").first().click();
await page.waitForFunction(() => document.querySelector("skinmint-model") && !document.querySelector(".wz-updating"), { timeout: 15000 }).catch(() => {});
await sleep(1500);
await page.screenshot({ path: `${OUT}/wz-1-who.png` });

// go to step 2 — 造型
await page.locator(".wz-next").click();
await sleep(700);
await page.screenshot({ path: `${OUT}/wz-2-look.png` });

// choose Q版 + 带底座
await page.getByText("Q 版", { exact: true }).click();
await sleep(400);
await page.getByText("带底座", { exact: true }).click();
await page.waitForFunction(() => !document.querySelector(".wz-updating"), { timeout: 15000 }).catch(() => {});
await sleep(1400);
await page.screenshot({ path: `${OUT}/wz-2b-look-chosen.png` });

// go to step 3 — 动作
await page.locator(".wz-next").click();
await sleep(700);
await page.screenshot({ path: `${OUT}/wz-3-pose.png` });

// choose 奔跑
await page.getByText("奔跑", { exact: true }).click();
await page.waitForFunction(() => !document.querySelector(".wz-updating"), { timeout: 15000 }).catch(() => {});
await sleep(1600);
await page.screenshot({ path: `${OUT}/wz-3b-pose-run.png` });

// choose 挥手
await page.getByText("挥手", { exact: true }).click();
await page.waitForFunction(() => !document.querySelector(".wz-updating"), { timeout: 15000 }).catch(() => {});
await sleep(1600);
await page.screenshot({ path: `${OUT}/wz-3c-pose-wave.png` });

await browser.close();
console.log("errors:", errs.slice(0, 6));
