import { removeBackground } from "../web/projectcore.mjs";
import { bandExtent, regionAverage } from "../web/mcatlas.mjs";

const W = 200, H = 400;
const src = new Uint8ClampedArray(W * H * 4);
const set = (x, y, c) => { const o = (y * W + x) * 4; src[o] = c[0]; src[o + 1] = c[1]; src[o + 2] = c[2]; src[o + 3] = 255; };
const WHITE = [255, 255, 255], HAIR = [70, 42, 34], SKIN = [232, 185, 140], SHIRT = [200, 48, 48], LEGS = [40, 58, 110], SHOE = [25, 25, 25];
for (let y = 0; y < H; y++) { const t = y / H; for (let x = 0; x < W; x++) { let c = WHITE; const inHead = x >= 80 && x < 120, inTorso = x >= 70 && x < 130, inLegs = x >= 78 && x < 122; if (t < 0.07 && inHead) c = HAIR; else if (t < 0.16 && inHead) c = SKIN; else if (t < 0.50 && inTorso) c = (x >= 86 && x < 114) ? SHIRT : SKIN; else if (t < 0.95 && inLegs) c = LEGS; else if (t >= 0.95 && inLegs) c = SHOE; set(x, y, c); } }
removeBackground(src, W, H, 30);

const neckY = Math.round(0.16 * H), hipY = Math.round(0.50 * H);
console.log("neckY", neckY, "hipY", hipY);
console.log("head extent", bandExtent(src, W, H, 0, neckY));
console.log("torso extent", bandExtent(src, W, H, neckY, hipY));
console.log("legs extent", bandExtent(src, W, H, hipY, H));
const tx = bandExtent(src, W, H, neckY, hipY);
const w = tx[1] - tx[0], armW = Math.max(1, Math.round((w * 0.5) / 2));
console.log("torso w", w, "armW", armW);
console.log("bodyReg avg", regionAverage(src, W, H, [tx[0] + armW, neckY, tx[1] - armW, hipY]));
console.log("rArm avg", regionAverage(src, W, H, [tx[0], neckY, tx[0] + armW, hipY]));
console.log("lArm avg", regionAverage(src, W, H, [tx[1] - armW, neckY, tx[1], hipY]));
