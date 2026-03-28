import { build } from "esbuild";
import { copyFileSync } from "fs";

await build({
  entryPoints: ["src/content.ts"],
  bundle: true,
  outfile: "dist/content.js",
  format: "iife",
  target: "es2022",
  sourcemap: true,
  minify: false,
});

// Copy manifest.json to dist/ so it can be loaded as an unpacked extension
copyFileSync("manifest.json", "dist/manifest.json");

console.log("Build complete: dist/content.js + dist/manifest.json");
