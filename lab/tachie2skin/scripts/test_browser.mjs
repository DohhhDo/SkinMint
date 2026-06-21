// Drive the REAL page like a user: upload, click generate, screenshot the
// result + capture console/network errors. Reveals browser-only bugs.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("/Users/mac/Projects/SkinMint/node_modules/playwright");

const file = process.argv[2] || "assets/kurumi.jpg";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));

await page.goto("http://localhost:8787", { waitUntil: "networkidle" });
await page.setInputFiles("#file", file);
await page.waitForFunction("!document.getElementById('go').disabled", { timeout: 5000 });
console.log("active tab:", await page.evaluate(() => window.__tabForTest ?? document.querySelector('.tab.active')?.textContent));
await page.click("#go");

// wait for either a result (actions visible) or an error message
try {
  await page.waitForFunction(
    "!document.getElementById('actions').hidden || document.getElementById('err').textContent",
    { timeout: 60000 },
  );
} catch { logs.push("[timeout] no result after 60s"); }
await page.waitForTimeout(1500);

const err = await page.evaluate(() => document.getElementById("err").textContent);
const meta = await page.evaluate(() => document.getElementById("capText").innerText);
console.log("err box:", err || "(none)");
console.log("meta:", meta || "(none)");
await page.locator("#pedestal").screenshot({ path: "out/browser_result.png" });
console.log("wrote out/browser_result.png");
console.log("--- console/network ---");
console.log(logs.join("\n") || "(clean)");
await browser.close();
