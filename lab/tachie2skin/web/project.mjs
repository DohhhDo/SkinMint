// Browser glue for mode B (区域投影 / 忠实档): decode the 立绘 in a canvas, run
// the deterministic projector, return a 64×64 skin PNG data URL. Fully local —
// no server, no key.

import { projectToAtlas } from "./projectcore.mjs";
import { ATLAS } from "./mcatlas.mjs";

const MAX_DIM = 512; // cap decode size for speed; projection is downsampling anyway

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("无法解码图片"));
    img.src = dataUrl;
  });
}

/**
 * @param {string} dataUrl  the 立绘 as a data URL
 * @param {object} guides   { neck, hip, torsoCenter, hairFace } fractions
 * @param {{ removeBg?: boolean, bgTol?: number }} [opts]
 * @returns {Promise<string>} a 64×64 PNG data URL
 */
export async function projectFromDataUrl(dataUrl, guides, opts = {}) {
  const img = await loadImage(dataUrl);
  let w = img.naturalWidth, h = img.naturalHeight;
  const scale = Math.min(1, MAX_DIM / Math.max(w, h));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));

  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const srcData = ctx.getImageData(0, 0, w, h);

  const atlas = projectToAtlas(srcData.data, w, h, guides, {
    removeBg: opts.removeBg !== false,
    bgTol: opts.bgTol ?? 36,
  });

  const out = document.createElement("canvas");
  out.width = ATLAS; out.height = ATLAS;
  const octx = out.getContext("2d");
  octx.putImageData(new ImageData(atlas, ATLAS, ATLAS), 0, 0);
  return out.toDataURL("image/png");
}
