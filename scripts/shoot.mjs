import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";

const OUT = "/tmp/skinmint-shots";
const URL = "http://localhost:3000";

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 2 });

const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector("canvas");

// 1) Placeholder (no model) — tight timing to prove it is NOT blocked by the HDRI.
await sleep(1000);
await page.screenshot({ path: `${OUT}/1-placeholder.png` });
console.log("shot 1: placeholder");

// 2) Load the Damaged Helmet sample.
await page.getByRole("combobox").first().selectOption({ label: "Damaged Helmet" });
await sleep(6000); // download GLB + decode + frames
await page.screenshot({ path: `${OUT}/2-helmet.png` });
console.log("shot 2: helmet loaded");

// 3) Wireframe toggle.
await page.getByText("Wireframe", { exact: true }).click();
await sleep(1500);
await page.screenshot({ path: `${OUT}/3-wireframe.png` });
console.log("shot 3: wireframe");

// 4) Sunset environment + show background.
await page.getByRole("combobox").nth(1).selectOption("sunset");
await page.getByText("Show background", { exact: true }).click();
await page.getByText("Wireframe", { exact: true }).click(); // back to solid
await sleep(2500);
await page.screenshot({ path: `${OUT}/4-sunset-bg.png` });
console.log("shot 4: sunset background");

await browser.close();
console.log("console/page errors:", errors.length ? errors : "none");
