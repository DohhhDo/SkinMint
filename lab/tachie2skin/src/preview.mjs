import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Writes a self-contained HTML page that renders the generated skin on a live,
 * rotatable Minecraft model via skinview3d (loaded from a CDN). No build step —
 * just open the file in a browser.
 *
 * @param {string} outDir
 * @param {string} skinFile  relative filename of the skin PNG in outDir
 * @param {string} title
 * @returns {string} the written preview.html path
 */
export function writePreview(outDir, skinFile, title) {
  const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>tachie2skin — ${title}</title>
<style>
  body { margin:0; background:#f4ece2; color:#3a2f28; font-family:ui-serif,Georgia,serif;
         display:flex; flex-direction:column; align-items:center; gap:12px; padding:24px; }
  h1 { font-size:18px; font-weight:600; letter-spacing:.02em; }
  canvas { background:#fff8ef; border-radius:14px; box-shadow:0 8px 30px rgba(120,80,50,.18); }
  .row { display:flex; gap:16px; align-items:center; }
  img.atlas { image-rendering:pixelated; width:128px; height:128px; border:1px solid #d9c7b3; border-radius:8px; background:#fff; }
  .hint { font-size:12px; color:#8a7866; }
</style>
</head>
<body>
  <h1>${title} — Minecraft skin</h1>
  <div class="row">
    <canvas id="view" width="320" height="420"></canvas>
    <div>
      <img class="atlas" src="./${skinFile}" alt="skin atlas" />
      <div class="hint">64×64 atlas</div>
    </div>
  </div>
  <div class="hint">拖动旋转 · skinview3d</div>
<script type="module">
  import { SkinViewer, WalkingAnimation } from "https://esm.sh/skinview3d@3";
  const viewer = new SkinViewer({
    canvas: document.getElementById("view"),
    width: 320, height: 420,
    skin: "./${skinFile}",
  });
  viewer.animation = new WalkingAnimation();
  viewer.animation.speed = 0.6;
  viewer.zoom = 0.85;
  viewer.controls.enableZoom = true;
</script>
</body>
</html>`;
  const path = join(outDir, "preview.html");
  writeFileSync(path, html);
  return path;
}
