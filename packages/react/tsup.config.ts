import { defineConfig } from "tsup";
import { readFile, writeFile } from "node:fs/promises";

const CLIENT_DIRECTIVE = '"use client";\n';

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  external: ["react"],
  // Hooks must run on the client; re-add the directive esbuild strips.
  async onSuccess() {
    for (const file of ["dist/index.js", "dist/index.cjs"]) {
      const code = await readFile(file, "utf8");
      if (!code.startsWith('"use client"')) {
        await writeFile(file, CLIENT_DIRECTIVE + code);
      }
    }
  },
});
