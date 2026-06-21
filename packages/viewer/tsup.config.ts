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
  // Keep the React/Three ecosystem as peers so consumers share a single instance.
  external: [
    "react",
    "react-dom",
    "three",
    "@react-three/fiber",
    "@react-three/drei",
  ],
  // esbuild strips module-level "use client" when bundling, so re-add it to the
  // top of each output file for Next.js / RSC consumers.
  async onSuccess() {
    for (const file of ["dist/index.js", "dist/index.cjs"]) {
      const code = await readFile(file, "utf8");
      if (!code.startsWith('"use client"')) {
        await writeFile(file, CLIENT_DIRECTIVE + code);
      }
    }
  },
});
