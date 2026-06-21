import { defineConfig } from "tsup";

export default defineConfig([
  // ESM build for `import "@skinmint/embed"` in app/bundler code.
  {
    entry: { "skinmint-embed": "src/index.ts" },
    format: ["esm"],
    platform: "browser",
    target: "es2020",
    dts: true,
    clean: true,
    minify: true,
    sourcemap: true,
  },
  // Self-contained IIFE for a plain <script src="…/skinmint-embed.global.js">.
  // three.js is bundled in so the file is fully drop-in. tsup adds the
  // ".global.js" suffix for the iife format.
  {
    entry: { "skinmint-embed": "src/index.ts" },
    format: ["iife"],
    platform: "browser",
    target: "es2020",
    minify: true,
    sourcemap: true,
  },
]);
